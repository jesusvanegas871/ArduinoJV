import threading
import time
import queue
from typing import List, Dict, Any, Optional

try:
    import serial
    import serial.tools.list_ports
    HAS_PYSERIAL = True
except ImportError:
    HAS_PYSERIAL = False

# Mappings for AGV Orientation Tracking
# Orientations: 0 = +Y (Up), 1 = +X (Right), 2 = -Y (Down), 3 = -X (Left)
DIR_UP = 0
DIR_RIGHT = 1
DIR_DOWN = 2
DIR_LEFT = 3


def waypoints_to_commands(route_waypoints: List[Dict[str, Any]]) -> List[str]:
    """
    Función pura que convierte una lista ordenada de waypoints (START, TRANSIT, PICK, END)
    en comandos atómicos para el firmware Arduino (F<n>, L, R, U, P).
    Rastra la posición y orientación del carro AGV (empieza en x=0, y=0 mirando hacia arriba +y / DIR_UP).
    """
    if not route_waypoints:
        return []

    commands: List[str] = []
    curr_x, curr_y = 0, 0
    curr_dir = DIR_UP  # Mirando hacia +y

    for wp in route_waypoints:
        wp_type = wp.get("type")
        if wp_type == "START":
            curr_x = int(wp.get("x", 0))
            curr_y = int(wp.get("y", 0))
            continue

        target_x = int(wp.get("x", curr_x))
        target_y = int(wp.get("y", curr_y))

        # Calcular si hay desplazamiento
        if target_x != curr_x or target_y != curr_y:
            desired_dir = curr_dir

            if target_x != curr_x:
                # Movimiento horizontal en corredor (y = 0 o y = 9)
                desired_dir = DIR_RIGHT if target_x > curr_x else DIR_LEFT
                distance_units = abs(target_x - curr_x) // 3  # Carriles de diferencia
            else:
                # Movimiento vertical en carril (x = 0, 3, 6, 9, 12)
                desired_dir = DIR_UP if target_y > curr_y else DIR_DOWN
                distance_units = abs(target_y - curr_y)  # Filas de diferencia

            # Calcular el giro necesario
            turn_diff = (desired_dir - curr_dir) % 4
            if turn_diff == 1:
                commands.append("R")
            elif turn_diff == 2:
                commands.append("U")
            elif turn_diff == 3:
                commands.append("L")

            curr_dir = desired_dir

            # Comando de avance por intersecciones / filas / carriles
            if distance_units > 0:
                commands.append(f"F{distance_units}")

            curr_x, curr_y = target_x, target_y

        # Manejo del evento de parada según tipo de waypoint
        if wp_type == "PICK":
            commands.append("P")

    return commands


class AGVSerialController:
    """
    Controlador de comunicación Serial con el Arduino real del AGV.
    Soporta puerto serial físico (PySerial) y un modo de simulación/mock.
    """

    def __init__(self):
        self.serial_port: Optional[Any] = None
        self.port_name: Optional[str] = None
        self.baudrate: int = 115200
        self.is_connected: bool = False
        self.is_mock: bool = False
        self.current_mode: str = "IDLE"  # "IDLE", "MANUAL", "ROUTE"
        self.last_event: str = "NINGUNO"
        self._lock = threading.Lock()
        self._read_thread: Optional[threading.Thread] = None
        self._stop_thread = False
        self._responses: queue.Queue[str] = queue.Queue()

    def get_available_ports(self) -> List[Dict[str, str]]:
        """Lista los puertos serie disponibles en el sistema operativo."""
        ports_list = []
        if HAS_PYSERIAL:
            try:
                for p in serial.tools.list_ports.comports():
                    ports_list.append({
                        "port": p.device,
                        "description": p.description or "Puerto Serie"
                    })
            except Exception as e:
                print(f"[AGV Serial] Error al listar puertos: {e}")

        # Siempre ofrecemos un puerto de prueba simulado si no hay hardware o para pruebas
        ports_list.append({
            "port": "SIMULADOR_MOCK",
            "description": "Modo Simulación / AGV Virtual"
        })
        return ports_list

    def connect(self, port: str, baudrate: int = 115200) -> Dict[str, Any]:
        """Conecta al puerto serial especificado."""
        with self._lock:
            if self.is_connected:
                self._disconnect_internal()

            self.port_name = port
            self.baudrate = baudrate

            if port == "SIMULADOR_MOCK":
                self.is_connected = True
                self.is_mock = True
                self.current_mode = "IDLE"
                self.last_event = "CONECTADO_SIMULADOR"
                return {"success": True, "message": "Conectado al Simulador Serial AGV Virtual."}

            if not HAS_PYSERIAL:
                return {"success": False, "message": "Error: La librería 'pyserial' no está instalada en el servidor backend."}

            try:
                self.serial_port = serial.Serial(port, baudrate, timeout=1.0)
                time.sleep(2.0)  # Tiempo de estabilización tras reset del Arduino
                self.is_connected = True
                self.is_mock = False
                self.current_mode = "IDLE"
                self.last_event = "CONECTADO"

                # Iniciar hilo de lectura de eventos desde el Arduino
                self._stop_thread = False
                self._read_thread = threading.Thread(target=self._listen_serial, daemon=True)
                self._read_thread.start()

                return {"success": True, "message": f"Conexión exitosa con el Arduino en el puerto '{port}' a {baudrate} baudios."}
            except serial.SerialException as e:
                self.is_connected = False
                self.serial_port = None
                errMsg = str(e)
                if "PermissionError" in errMsg or "Access is denied" in errMsg:
                    msg = f"Permiso denegado al acceder al puerto '{port}'. Verifica que no esté abierto en el IDE de Arduino."
                elif "FileNotFoundError" in errMsg or "NoSuchFile" in errMsg:
                    msg = f"El puerto '{port}' no fue encontrado. Verifica la conexión del cable USB."
                else:
                    msg = f"Error al abrir el puerto serial '{port}': {errMsg}"
                return {"success": False, "message": msg}

    def _listen_serial(self):
        """Hilo en segundo plano para escuchar notificaciones del Arduino (EVT:*)."""
        while not self._stop_thread and self.is_connected and self.serial_port and self.serial_port.is_open:
            try:
                line = self.serial_port.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    if line.startswith("EVT:"):
                        self.last_event = line
                        if line == "EVT:ROUTE_DONE":
                            self.current_mode = "IDLE"
                    else:
                        self._responses.put(line)
            except Exception:
                break
            time.sleep(0.05)

    def _disconnect_internal(self):
        self._stop_thread = True
        if self.serial_port and self.serial_port.is_open:
            try:
                self.serial_port.close()
            except Exception:
                pass
        self.serial_port = None
        self.is_connected = False
        self.is_mock = False
        self.current_mode = "IDLE"
        while not self._responses.empty():
            try:
                self._responses.get_nowait()
            except queue.Empty:
                break

    def disconnect(self) -> Dict[str, Any]:
        """Desconecta el puerto serie."""
        with self._lock:
            self._disconnect_internal()
            return {"success": True, "message": "Desconectado del puerto serie del AGV."}

    def send_command(self, cmd: str) -> Dict[str, Any]:
        """Envía una línea de comando terminada en '\\n' al Arduino."""
        return self.send_commands([cmd])

    def send_commands(self, commands: List[str]) -> Dict[str, Any]:
        """Envía comandos en orden y recoge sus respuestas sin competir con el lector serial."""
        if not self.is_connected:
            return {"success": False, "message": "El AGV no está conectado por puerto serial."}

        commands_clean = [cmd.strip() for cmd in commands]

        if self.is_mock:
            for cmd_clean in commands_clean:
                if cmd_clean.startswith("M:"):
                    self.current_mode = "IDLE" if cmd_clean == "M:S" else "MANUAL"
                elif cmd_clean.startswith("ROUTE:"):
                    self.current_mode = "ROUTE"
                elif cmd_clean == "STOP":
                    self.current_mode = "IDLE"
            return {"success": True, "response": "OK", "command_sent": commands_clean[-1]}

        with self._lock:
            try:
                responses = []
                for cmd_clean in commands_clean:
                    self.serial_port.write(f"{cmd_clean}\n".encode('utf-8'))
                    try:
                        response = self._responses.get(timeout=2.0)
                    except queue.Empty:
                        return {
                            "success": False,
                            "message": f"El Arduino no respondió al comando '{cmd_clean}'. Verifica el firmware y la conexión serial."
                        }

                    if response.startswith("ERR:"):
                        return {"success": False, "message": f"Arduino reportó error: {response}", "response": response}
                    responses.append(response)

                    if cmd_clean.startswith("M:"):
                        self.current_mode = "IDLE" if cmd_clean == "M:S" else "MANUAL"
                    elif cmd_clean.startswith("ROUTE:"):
                        self.current_mode = "ROUTE"
                    elif cmd_clean == "STOP":
                        self.current_mode = "IDLE"

                return {
                    "success": True,
                    "response": responses[-1] if responses else "OK",
                    "command_sent": commands_clean[-1] if commands_clean else None
                }
            except Exception as e:
                self._disconnect_internal()
                return {"success": False, "message": f"Error de comunicación durante el envío serial: {str(e)}"}

    def get_status(self) -> Dict[str, Any]:
        """Devuelve el estado actual de la conexión y del controlador."""
        return {
            "connected": self.is_connected,
            "port": self.port_name,
            "baudrate": self.baudrate,
            "is_mock": self.is_mock,
            "mode": self.current_mode,
            "last_event": self.last_event
        }


# Instancia global del controlador serial
agv_serial = AGVSerialController()
