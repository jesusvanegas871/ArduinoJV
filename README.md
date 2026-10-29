# Módulo de Control y Conexión AGV Real — Hackatón Logística 2026

Este módulo extiende la plataforma WMS con la capacidad de conectar y controlar un **carro AGV real (seguidor de línea con tracción diferencial)** controlado por un Arduino vía USB Serial a 115200 baudios.

---

## 1. Supuestos sobre el Hardware y la Línea del Piso

- **Placa Microcontroladora:** Arduino Uno / Nano / Mega (ATmega @ 16MHz).
- **Driver de Motores:** L298N o TB6612FNG controlando 2 motores DC en tracción diferencial (rueda izquierda y rueda derecha).
- **Sensores de Línea:** Arreglo de 5 sensores infrarrojos (IR) reflectivos (IR 1 a IR 5) alineados horizontalmente.
  - El piso es de color claro/blanco y la línea guía es negra.
  - Al posicionarse sobre una marca transversal/intersección, los sensores detectan el color negro (al menos 4 de 5 sensores activos).
- **Buzzer:** Buzzer activo o pasivo en pin digital `D13`.
- **Navegación del Layout:**
  - Red formada por 5 carriles verticales (`x = 0, 3, 6, 9, 12`) y 2 corredores horizontales (`y = 0` inferior y `y = 9` superior).
  - El carro parte desde la posición de entrada/despacho `(x:0, y:0)` orientado hacia arriba (`+y`).
  - Las filas de racks van de `y = 1` a `y = 8`. Cada fila tiene una marca transversal en la línea negra que permite detectar las intersecciones de llegada.

---

## 2. Diagrama de Cableado Sugerido

```
  +--------------------------------------------------------+
  |                     ARDUINO UNO / NANO                 |
  +--------------------------------------------------------+
     |   |   |   |   |   |      |   |   |   |   |      |
    D2  D3  D4  D5  D6  D7     A0  A1  A2  A3  A4     D13
     |   |   |   |   |   |      |   |   |   |   |      |
  +------------------------+  +-------------------+  +--------+
  | DRIVER L298N / TB6612  |  |  MÓDULO 5x IR     |  | BUZZER |
  | IN1 IN2 IN3 IN4 ENA ENB|  |  S1 S2 S3 S4 S5   |  |   (+)  |
  +------------------------+  +-------------------+  +--------+
     |   |     |   |            (Izquierda -> Der)
  Motor Izq. Motor Der.
```

- **Pines del Driver de Motores:**
  - `ENA` -> Pin `D5` (PWM Izquierdo)
  - `IN1` -> Pin `D2` | `IN2` -> Pin `D3`
  - `ENB` -> Pin `D6` (PWM Derecho)
  - `IN3` -> Pin `D4` | `IN4` -> Pin `D7`
- **Pines de Sensores IR de Línea:**
  - `S1` -> Pin `A0` (Extremo Izquierdo)
  - `S2` -> Pin `A1` (Medio Izquierdo)
  - `S3` -> Pin `A2` (Centro)
  - `S4` -> Pin `A3` (Medio Derecho)
  - `S5` -> Pin `A4` (Extremo Derecho)
- **Buzzer Activo:**
  - Positivo (`+`) -> Pin `D13` | Negativo (`-`) -> `GND`

---

## 3. Carga del Firmware Arduino

1. Abre el software **Arduino IDE**.
2. Abre el archivo de firmware ubicado en `arduino/agv_firmware/agv_firmware.ino`.
3. Selecciona tu placa en **Herramientas > Placa** (ej. *Arduino Uno*).
4. Selecciona el puerto USB asignado en **Herramientas > Puerto** (ej. `COM3` en Windows o `/dev/ttyUSB0` en Linux/macOS).
5. Haz clic en **Cargar (Upload)**.
6. Abre el **Monitor Serie** configurado a **115200 baudios** para verificar que el Arduino responda enviando `OK` ante comandos como `BEEP:200`.

---

## 4. Instalación de Dependencias e Início del Backend

1. Instala `pyserial` y las dependencias del backend:
   ```bash
   pip install pyserial fastapi uvicorn
   ```

2. Ejecuta el servidor backend FastAPI desde la raíz del proyecto:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

3. Inicia el frontend React:
   ```bash
   cd frontend
   npm run dev
   ```

---

## 5. Cómo Probar el Carro Sin la Ruta (Solo Manual y Pitido)

1. En la aplicación web React, navega al panel **"Conexión AGV Real (Arduino USB Serial)"**.
2. Selecciona el puerto USB correspondiente de la lista desplegable y haz clic en **"Conectar Arduino"**.
3. **Prueba de Pitido:**
   - Haz clic en el botón **"Activar Pitido (Buzzer)"**. El Arduino emitirá un tono audible y responderá `OK`.
4. **Prueba de Control Manual:**
   - Usa los botones del D-Pad en pantalla (Adelante, Atrás, Izquierda, Derecha, STOP).
   - O bien mantén presionadas las teclas **WASD** o **Flechas del Teclado**.
   - Al presionar una tecla, el carrito se moverá en esa dirección. Al soltarla, se detendrá inmediatamente (`M:S`).
   - Ajusta la velocidad base con el deslizador (rango 80 - 255).
   - Si se interrumpe la señal durante 500 ms, el sistema de seguridad (*failsafe*) detendrá automáticamente los motores.
