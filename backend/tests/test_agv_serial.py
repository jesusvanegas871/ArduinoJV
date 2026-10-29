import pytest
from fastapi.testclient import TestClient

from backend.agv_serial import waypoints_to_commands, agv_serial
from backend.picking import SmartPickingEngine
from backend.main import app

def test_waypoints_to_commands_example_locations():
    # Instanciar el motor de picking y calcular ruta para la lista de ejemplo
    picking_engine = SmartPickingEngine([])
    route_res = picking_engine.calculate_manual_route([4, 17, 41, 60, 7, 25])
    assert route_res["success"] is True

    waypoints = route_res["route_waypoints"]
    commands = waypoints_to_commands(waypoints)

    assert isinstance(commands, list)
    assert len(commands) > 0

    # Verificar que solo contenga los tokens de firmware especificados: F<n>, L, R, U, P
    for cmd in commands:
        if cmd in ("L", "R", "U", "P"):
            continue
        assert cmd.startswith("F")
        assert cmd[1:].isdigit()

    # Verificar que los comandos comiencen girando a la derecha y avanzando al primer carril
    assert commands[0] == "R"
    assert commands[1] == "F1"
    assert commands[2] == "L"
    assert commands[3] == "F2"
    assert commands[4] == "P"  # Parada Nivel 1 en loc 4
    assert commands[5] == "P"  # Parada Nivel 2 en loc 4 (Doble Parada Obligatoria)

    # Verificar que las paradas de picking ('P') sumen la cantidad requerida
    # Para [4, 17, 41, 60, 7, 25]: loc 4 (2 stops), 17 (1), 25 (2), 41 (1), 60 (2), 7 (1) = 9 paradas 'P'
    p_count = commands.count("P")
    assert p_count == 9

def test_waypoints_to_commands_edge_cases():
    # Caso 1: Lista vacía
    assert waypoints_to_commands([]) == []

    # Caso 2: Solo punto de inicio y fin
    start_end_wps = [
        {"type": "START", "x": 0, "y": 0},
        {"type": "END", "x": 0, "y": 0}
    ]
    assert waypoints_to_commands(start_end_wps) == []

    # Caso 3: Avance directo en el mismo carril x=0 sin giros
    lane_wps = [
        {"type": "START", "x": 0, "y": 0},
        {"type": "PICK", "x": 0, "y": 5},
        {"type": "END", "x": 0, "y": 0}
    ]
    cmds = waypoints_to_commands(lane_wps)
    assert cmds == ["F5", "P", "U", "F5"]

def test_agv_fastapi_endpoints():
    client = TestClient(app)

    # GET /api/agv/ports
    res_ports = client.get("/api/agv/ports")
    assert res_ports.status_code == 200
    json_ports = res_ports.json()
    assert "ports" in json_ports
    assert len(json_ports["ports"]) >= 1

    # POST /api/agv/connect (usando el simulador mock)
    res_conn = client.post("/api/agv/connect", json={"port": "SIMULADOR_MOCK", "baudrate": 115200})
    assert res_conn.status_code == 200
    assert res_conn.json()["success"] is True

    # GET /api/agv/status
    res_status = client.get("/api/agv/status")
    assert res_status.status_code == 200
    json_status = res_status.json()["status"]
    assert json_status["connected"] is True
    assert json_status["port"] == "SIMULADOR_MOCK"

    # POST /api/agv/manual
    res_man = client.post("/api/agv/manual", json={"command": "F", "speed": 200})
    assert res_man.status_code == 200
    assert res_man.json()["success"] is True

    # POST /api/agv/beep
    res_beep = client.post("/api/agv/beep", json={"duration_ms": 300})
    assert res_beep.status_code == 200
    assert res_beep.json()["success"] is True

    # POST /api/agv/route/start
    picking_engine = SmartPickingEngine([])
    route_res = picking_engine.calculate_manual_route([4, 7])
    waypoints = route_res["route_waypoints"]

    res_route = client.post("/api/agv/route/start", json={"route_waypoints": waypoints})
    assert res_route.status_code == 200
    json_route = res_route.json()
    assert json_route["success"] is True
    assert "commands" in json_route
    assert len(json_route["commands"]) > 0

    # POST /api/agv/route/continue
    res_cont = client.post("/api/agv/route/continue")
    assert res_cont.status_code == 200
    assert res_cont.json()["success"] is True

    # POST /api/agv/route/stop
    res_stop = client.post("/api/agv/route/stop")
    assert res_stop.status_code == 200
    assert res_stop.json()["success"] is True

    # POST /api/agv/disconnect
    res_disc = client.post("/api/agv/disconnect")
    assert res_disc.status_code == 200
    assert res_disc.json()["success"] is True
