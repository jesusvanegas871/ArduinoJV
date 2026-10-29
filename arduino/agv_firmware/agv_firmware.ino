/*
  agv_firmware.ino - Firmware para Carro AGV Seguidor de Línea (Hackatón Logística 2026)

  Soporta:
  1. Control manual con timeout de seguridad (failsafe 500 ms).
  2. Seguimiento de línea negra sobre piso claro con control proporcional (PD).
  3. Ejecución de ruta por comandos: F<n>, L, R, U, P con parada de picking y esperas.
  4. Activación de Buzzer pasivo/activo.
  5. Protocolo serial a 115200 baudios.
*/

// ==========================================
// CONFIGURACIÓN Y CONSTANTES CONFIGURABLES
// ==========================================
const long SERIAL_BAUD = 115200;

// Motor Driver Pins (L298N / TB6612 compatible)
const int PIN_ENA = 5;   // PWM Motor Izquierdo
const int PIN_IN1 = 2;   // Dir 1 Izquierdo
const int PIN_IN2 = 3;   // Dir 2 Izquierdo
const int PIN_ENB = 6;   // PWM Motor Derecho
const int PIN_IN3 = 4;   // Dir 1 Derecho
const int PIN_IN4 = 7;   // Dir 2 Derecho

// 5 Sensores IR de Línea (de Izquierda a Derecha: S1, S2, S3, S4, S5)
const int PIN_IR_1 = A0; // Extremo Izquierdo
const int PIN_IR_2 = A1; // Medio Izquierdo
const int PIN_IR_3 = A2; // Centro
const int PIN_IR_4 = A3; // Medio Derecho
const int PIN_IR_5 = A4; // Extremo Derecho

// Umbral para sensores analógicos (si se leen en analógico; si se usan digitales, HIGH = negro)
const int IR_THRESHOLD = 500;

// Buzzer Activo
const int PIN_BUZZER = 13;

// Parámetros de Control y Velocidad
int g_currentSpeed = 180;          // Velocidad base (0 - 255)
const int MIN_SPEED = 80;
const int MAX_SPEED = 255;

// Constantes de Control Proporcional (PD) para seguimiento de línea
const float KP = 35.0;
const float KD = 15.0;

// Failsafe en modo manual (ms sin recibir comando M:* para detenerse)
const unsigned long MANUAL_FAILSAFE_MS = 500;

// ==========================================
// ESTADOS Y VARIABLES GLOBALES
// ==========================================
enum Mode {
  MODE_IDLE,
  MODE_MANUAL,
  MODE_ROUTE
};

Mode g_mode = MODE_IDLE;

// Manual Mode Failsafe
unsigned long g_lastManualCmdTime = 0;

// Beep en progreso
unsigned long g_beepEndTime = 0;
bool g_isBeeping = false;

// Buffer de comandos de Ruta
const int MAX_ROUTE_STEPS = 64;
String g_routeSteps[MAX_ROUTE_STEPS];
int g_routeTotalSteps = 0;
int g_routeCurrentStepIdx = 0;
bool g_routeRunning = false;
bool g_routeWaitingForContinue = false;

// Para conteo de intersecciones en paso F<n>
int g_fIntersectionsRemaining = 0;
bool g_intersectionDebounce = false;

// Variables PD
float g_lastError = 0.0;

// ==========================================
// FUNCIONES AUXILIARES DE HARDWARE
// ==========================================

// Configuración de pines
void setupHardware() {
  pinMode(PIN_ENA, OUTPUT);
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_ENB, OUTPUT);
  pinMode(PIN_IN3, OUTPUT);
  pinMode(PIN_IN4, OUTPUT);

  pinMode(PIN_IR_1, INPUT);
  pinMode(PIN_IR_2, INPUT);
  pinMode(PIN_IR_3, INPUT);
  pinMode(PIN_IR_4, INPUT);
  pinMode(PIN_IR_5, INPUT);

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  stopMotors();
}

// Control directo de motores (pwmLeft, pwmRight pueden ser positivos para avanzar o negativos para retroceder)
void setMotors(int speedLeft, int speedRight) {
  // Motor Izquierdo
  if (speedLeft >= 0) {
    digitalWrite(PIN_IN1, HIGH);
    digitalWrite(PIN_IN2, LOW);
  } else {
    digitalWrite(PIN_IN1, LOW);
    digitalWrite(PIN_IN2, HIGH);
    speedLeft = -speedLeft;
  }
  speedLeft = constrain(speedLeft, 0, 255);
  analogWrite(PIN_ENA, speedLeft);

  // Motor Derecho
  if (speedRight >= 0) {
    digitalWrite(PIN_IN3, HIGH);
    digitalWrite(PIN_IN4, LOW);
  } else {
    digitalWrite(PIN_IN3, LOW);
    digitalWrite(PIN_IN4, HIGH);
    speedRight = -speedRight;
  }
  speedRight = constrain(speedRight, 0, 255);
  analogWrite(PIN_ENB, speedRight);
}

void stopMotors() {
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, LOW);
  analogWrite(PIN_ENA, 0);
  analogWrite(PIN_ENB, 0);
}

// Control del Buzzer
void startBeep(unsigned long durationMs) {
  digitalWrite(PIN_BUZZER, HIGH);
  g_beepEndTime = millis() + durationMs;
  g_isBeeping = true;
}

void updateBuzzer() {
  if (g_isBeeping && millis() >= g_beepEndTime) {
    digitalWrite(PIN_BUZZER, LOW);
    g_isBeeping = false;
  }
}

// Lectura de los 5 sensores de línea (devuelve true si el sensor ve la línea negra)
bool readSensor(int pin) {
  int val = analogRead(pin);
  return (val >= IR_THRESHOLD);
}

struct SensorReadings {
  bool s1, s2, s3, s4, s5;
  int countBlack;
};

SensorReadings readAllSensors() {
  SensorReadings r;
  r.s1 = readSensor(PIN_IR_1);
  r.s2 = readSensor(PIN_IR_2);
  r.s3 = readSensor(PIN_IR_3);
  r.s4 = readSensor(PIN_IR_4);
  r.s5 = readSensor(PIN_IR_5);
  r.countBlack = (r.s1 ? 1 : 0) + (r.s2 ? 1 : 0) + (r.s3 ? 1 : 0) + (r.s4 ? 1 : 0) + (r.s5 ? 1 : 0);
  return r;
}

// Detecta si se alcanzó una intersección o marca transversal (al menos 4 de 5 sensores en negro)
bool isIntersection(const SensorReadings& r) {
  return (r.countBlack >= 4) || (r.s1 && r.s2 && r.s4 && r.s5);
}

// ==========================================
// SEGUIMIENTO DE LÍNEA (PD)
// ==========================================
void lineFollowStep() {
  SensorReadings r = readAllSensors();

  // Calcular error ponderado de posición (-2.0 extremo izq a +2.0 extremo der)
  float error = 0.0;
  if (r.s1) error -= 2.0;
  if (r.s2) error -= 1.0;
  if (r.s3) error += 0.0;
  if (r.s4) error += 1.0;
  if (r.s5) error += 2.0;

  if (r.countBlack == 0) {
    // Si se perdió la línea, usar el último error para corregir agresivamente
    error = (g_lastError > 0) ? 2.5 : -2.5;
  } else {
    error = error / (float)r.countBlack;
  }

  float derivative = error - g_lastError;
  g_lastError = error;

  float correction = (KP * error) + (KD * derivative);

  int leftMotor = g_currentSpeed + (int)correction;
  int rightMotor = g_currentSpeed - (int)correction;

  setMotors(leftMotor, rightMotor);
}

// ==========================================
// GIROS GUIADOS POR SENSORES
// ==========================================
void executeTurnLeft() {
  // Pivotar a la izquierda hasta que el sensor central (s3) detecte la línea negra
  setMotors(-g_currentSpeed, g_currentSpeed);
  delay(200); // Pequeño impulso inicial para salir de la línea actual
  unsigned long startTurn = millis();
  while (millis() - startTurn < 2500) {
    SensorReadings r = readAllSensors();
    if (r.s3 || r.s2) break; // Centrado en nueva línea
    delay(10);
  }
  stopMotors();
}

void executeTurnRight() {
  // Pivotar a la derecha hasta que el sensor central (s3) detecte la línea negra
  setMotors(g_currentSpeed, -g_currentSpeed);
  delay(200); // Pequeño impulso inicial
  unsigned long startTurn = millis();
  while (millis() - startTurn < 2500) {
    SensorReadings r = readAllSensors();
    if (r.s3 || r.s4) break; // Centrado en nueva línea
    delay(10);
  }
  stopMotors();
}

void executeTurnU() {
  // Giro de 180° pivotando sobre su propio eje
  setMotors(g_currentSpeed, -g_currentSpeed);
  delay(400); // Impulso para sobrepasar la línea original
  unsigned long startTurn = millis();
  while (millis() - startTurn < 3500) {
    SensorReadings r = readAllSensors();
    if (r.s3) break;
    delay(10);
  }
  stopMotors();
}

// ==========================================
// EJECUCIÓN PASO A PASO EN MODO RUTA
// ==========================================
void startCurrentRouteStep() {
  if (g_routeCurrentStepIdx >= g_routeTotalSteps) {
    // Ruta finalizada
    stopMotors();
    g_routeRunning = false;
    g_mode = MODE_IDLE;
    Serial.println("EVT:ROUTE_DONE");
    return;
  }

  String step = g_routeSteps[g_routeCurrentStepIdx];
  step.trim();

  if (step.startsWith("F")) {
    // Avanzar N intersecciones
    int count = step.substring(1).toInt();
    if (count <= 0) count = 1;
    g_fIntersectionsRemaining = count;
    g_intersectionDebounce = false;
  } else if (step == "L") {
    executeTurnLeft();
    g_routeCurrentStepIdx++;
    startCurrentRouteStep();
  } else if (step == "R") {
    executeTurnRight();
    g_routeCurrentStepIdx++;
    startCurrentRouteStep();
  } else if (step == "U") {
    executeTurnU();
    g_routeCurrentStepIdx++;
    startCurrentRouteStep();
  } else if (step == "P") {
    // Parada de Picking
    stopMotors();
    startBeep(500);
    g_routeWaitingForContinue = true;
    Serial.println("EVT:PICK_REACHED");
  } else {
    // Paso no reconocido
    g_routeCurrentStepIdx++;
    startCurrentRouteStep();
  }
}

void updateRouteExecution() {
  if (!g_routeRunning || g_routeWaitingForContinue) return;

  String step = g_routeSteps[g_routeCurrentStepIdx];
  step.trim();

  if (step.startsWith("F")) {
    // Seguimiento de línea mientras cuenta intersecciones
    lineFollowStep();

    SensorReadings r = readAllSensors();
    bool atInter = isIntersection(r);

    if (atInter && !g_intersectionDebounce) {
      g_intersectionDebounce = true;
      g_fIntersectionsRemaining--;
      Serial.println("EVT:INTERSECTION");

      if (g_fIntersectionsRemaining <= 0) {
        // Alcanzó la cota deseada
        g_routeCurrentStepIdx++;
        startCurrentRouteStep();
      }
    } else if (!atInter && g_intersectionDebounce) {
      g_intersectionDebounce = false; // Reset debounce
    }
  }
}

// ==========================================
// PROCESAMIENTO DE COMANDOS SERIALES
// ==========================================
void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  // Manual: M:F, M:B, M:L, M:R, M:S
  if (cmd.startsWith("M:")) {
    String sub = cmd.substring(2);
    if (sub == "S") {
      stopMotors();
      g_mode = MODE_IDLE;
      Serial.println("OK");
    } else if (sub == "F") {
      g_mode = MODE_MANUAL;
      g_lastManualCmdTime = millis();
      setMotors(g_currentSpeed, g_currentSpeed);
      Serial.println("OK");
    } else if (sub == "B") {
      g_mode = MODE_MANUAL;
      g_lastManualCmdTime = millis();
      setMotors(-g_currentSpeed, -g_currentSpeed);
      Serial.println("OK");
    } else if (sub == "L") {
      g_mode = MODE_MANUAL;
      g_lastManualCmdTime = millis();
      setMotors(-g_currentSpeed, g_currentSpeed);
      Serial.println("OK");
    } else if (sub == "R") {
      g_mode = MODE_MANUAL;
      g_lastManualCmdTime = millis();
      setMotors(g_currentSpeed, -g_currentSpeed);
      Serial.println("OK");
    } else {
      Serial.println("ERR:COMANDO_MANUAL_DESCONOCIDO");
    }
    return;
  }

  // Velocidad: SPD:<0-255>
  if (cmd.startsWith("SPD:")) {
    int spd = cmd.substring(4).toInt();
    if (spd >= 0 && spd <= 255) {
      g_currentSpeed = spd;
      Serial.println("OK");
    } else {
      Serial.println("ERR:VELOCIDAD_INVALIDA");
    }
    return;
  }

  // Buzzer: BEEP:<ms>
  if (cmd.startsWith("BEEP:")) {
    int duration = cmd.substring(5).toInt();
    if (duration <= 0) duration = 200;
    startBeep(duration);
    Serial.println("OK");
    return;
  }

  // Carga de Ruta: ROUTE:F2,R,F1,P,F1,L,F3
  if (cmd.startsWith("ROUTE:")) {
    String stepsStr = cmd.substring(6);
    g_routeTotalSteps = 0;

    int startIdx = 0;
    while (startIdx < stepsStr.length()) {
      int commaIdx = stepsStr.indexOf(',', startIdx);
      if (commaIdx == -1) commaIdx = stepsStr.length();

      String token = stepsStr.substring(startIdx, commaIdx);
      token.trim();
      if (token.length() > 0 && g_routeTotalSteps < MAX_ROUTE_STEPS) {
        g_routeSteps[g_routeTotalSteps++] = token;
      }
      startIdx = commaIdx + 1;
    }

    g_routeCurrentStepIdx = 0;
    g_routeRunning = false;
    g_routeWaitingForContinue = false;
    g_mode = MODE_ROUTE;
    Serial.println("OK");
    return;
  }

  // Iniciar ejecución de ruta: GO
  if (cmd == "GO") {
    if (g_mode == MODE_ROUTE && g_routeTotalSteps > 0) {
      g_routeRunning = true;
      g_routeWaitingForContinue = false;
      Serial.println("OK");
      startCurrentRouteStep();
    } else {
      Serial.println("ERR:NO_HAY_RUTA_CARGADA");
    }
    return;
  }

  // Continuar tras un PICK: CONTINUE
  if (cmd == "CONTINUE") {
    if (g_mode == MODE_ROUTE && g_routeWaitingForContinue) {
      g_routeWaitingForContinue = false;
      g_routeCurrentStepIdx++;
      Serial.println("OK");
      startCurrentRouteStep();
    } else {
      Serial.println("ERR:NO_ESPERANDO_CONTINUE");
    }
    return;
  }

  // Abortar/Parar: STOP
  if (cmd == "STOP") {
    stopMotors();
    g_routeRunning = false;
    g_routeWaitingForContinue = false;
    g_mode = MODE_IDLE;
    Serial.println("OK");
    return;
  }

  Serial.println("ERR:COMANDO_NO_RECONOCIDO");
}

// ==========================================
// SETUP Y LOOP PRINCIPAL
// ==========================================
void setup() {
  Serial.begin(SERIAL_BAUD);
  setupHardware();
}

void loop() {
  // 1. Lectura Serial no bloqueante por línea
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    processCommand(line);
  }

  // 2. Failsafe para modo Manual (500 ms)
  if (g_mode == MODE_MANUAL) {
    if (millis() - g_lastManualCmdTime > MANUAL_FAILSAFE_MS) {
      stopMotors();
      g_mode = MODE_IDLE;
    }
  }

  // 3. Actualizar Ruta si está en ejecución
  if (g_mode == MODE_ROUTE) {
    updateRouteExecution();
  }

  // 4. Actualizar temporizador del Buzzer
  updateBuzzer();
}
