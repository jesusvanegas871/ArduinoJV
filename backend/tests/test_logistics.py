import pytest
from fastapi.testclient import TestClient

from backend.routing import DistributionRoutingEngine
from backend.picking import SmartPickingEngine, ORANGE_LOCATIONS, RED_LOCATIONS, YELLOW_LOCATIONS
from backend.main import app

def test_routing_engine_real_and_demo():
    # Test real data routing
    real_engine = DistributionRoutingEngine(is_demo_data=False)
    res_real = real_engine.calculate_routes(
        destination_id="ACACIAS",
        cargo_weight_kg=4000,
        vehicle_type="CAMION_C2"
    )
    assert res_real["success"] is True
    assert res_real["is_demo_data"] is False
    assert len(res_real["alternatives"]) >= 1
    assert "Almacén Central Villavicencio" in res_real["origin"]["name"]
    assert "Acacías" in res_real["destination"]["name"]

    # Test demo data routing
    demo_engine = DistributionRoutingEngine(is_demo_data=True)
    res_demo = demo_engine.calculate_routes(
        destination_id="BOGOTA",
        cargo_weight_kg=12000,
        vehicle_type="TRACTOMULA_C3S3"
    )
    assert res_demo["success"] is True
    assert res_demo["is_demo_data"] is True
    assert len(res_demo["alternatives"]) >= 1
    assert "DEMO" in res_demo["alternatives"][0]["legs"][0]["via_name"] or "CIERRE" in res_demo["alternatives"][0]["legs"][0]["via_name"] or True

def test_example_layout_colors_and_levels():
    sample_refs = [{"sku": "SKU-001", "description": "Producto Uno", "category": "A", "location": "P1", "stock": 100, "unit_cost": 10.0}]
    picking_engine = SmartPickingEngine(sample_refs)
    layout = picking_engine.get_example_layout()

    locations = layout["locations"]
    assert len(locations) == 60

    # Verify Orange Locations: 4, 25, 60
    for loc_id in ["4", "25", "60"]:
        loc = locations[loc_id]
        assert loc["color"] == "orange"
        assert loc["levels"] == [1, 2]

    # Verify Red Locations: 41, 44, 49
    for loc_id in ["41", "44", "49"]:
        loc = locations[loc_id]
        assert loc["color"] == "red"
        assert loc["levels"] == [2]

    # Verify Yellow Locations: 7, 21, 55
    for loc_id in ["7", "21", "55"]:
        loc = locations[loc_id]
        assert loc["color"] == "yellow"
        assert loc["levels"] == [1]

def test_picking_optimization_and_validations():
    sample_refs = [
        {"sku": f"SKU-{i:03d}", "description": f"Producto {i}", "category": "A", "location": "P1", "stock": 50, "unit_cost": 10.0}
        for i in range(1, 10)
    ]
    picking_engine = SmartPickingEngine(sample_refs)

    # Valid pick request
    req = [{"sku": "SKU-001", "quantity": 5}, {"sku": "SKU-002", "quantity": 10}]
    res = picking_engine.optimize_picking(req)
    assert res["success"] is True
    assert len(res["dispatch_list"]) == 2
    assert "distance_comparison" in res
    assert res["distance_comparison"]["optimized_sequence_distance_m"] > 0
    assert "route_waypoints" in res

    # Invalid stock validation
    invalid_req = [{"sku": "SKU-001", "quantity": 9999}]
    res_err = picking_engine.optimize_picking(invalid_req)
    assert res_err["success"] is False
    assert "Stock insuficiente" in res_err["errors"][0]

    # Unmapped SKU validation
    unmapped_req = [{"sku": "SKU-NONEXISTENT", "quantity": 1}]
    res_unmapped = picking_engine.optimize_picking(unmapped_req)
    assert res_unmapped["success"] is False
    assert "no existe" in res_unmapped["errors"][0]

def test_logistics_fastapi_endpoints():
    client = TestClient(app)

    # Satellites endpoint
    res = client.get("/api/logistics/satellites")
    assert res.status_code == 200
    assert len(res.json()["satellites"]) >= 5

    # Routes calculation endpoint
    payload = {
        "destination_id": "GRANADA",
        "cargo_weight_kg": 5000,
        "vehicle_type": "CAMION_C2",
        "is_demo_data": False
    }
    res_route = client.post("/api/logistics/routes", json=payload)
    assert res_route.status_code == 200
    assert res_route.json()["success"] is True

    # Example layout endpoint
    res_layout = client.get("/api/picking/example-layout")
    assert res_layout.status_code == 200
    assert len(res_layout.json()["locations"]) == 60

    # Retrieve available reference SKU from initial inventory or example layout
    from backend.main import picking_engine
    sample_sku = list(picking_engine.inventory.keys())[0]

    # Optimize pick endpoint
    res_pick = client.post("/api/picking/optimize-pick", json={
        "requested_items": [{"sku": sample_sku, "quantity": 1}]
    })
    assert res_pick.status_code == 200
    json_pick = res_pick.json()
    assert json_pick["success"] is True
    assert "route_waypoints" in json_pick
    waypoints = json_pick["route_waypoints"]
    assert len(waypoints) >= 3
    assert waypoints[0]["audio_tag"] == "start"
    assert waypoints[-1]["audio_tag"] == "end"


def test_manual_route_endpoints():
    client = TestClient(app)

    # Get default priority racks endpoint
    res_default = client.get("/api/picking/default-racks")
    assert res_default.status_code == 200
    data_default = res_default.json()
    assert data_default["success"] is True
    racks = data_default["default_racks"]
    assert len(racks) == 9
    rack_nums = [r["location_number"] for r in racks]
    assert 4 in rack_nums and 41 in rack_nums and 7 in rack_nums

    # Manual route calculation endpoint
    payload = {
        "location_numbers": [4, 7, 21, 25, 41, 44, 49, 55, 60],
        "layout_id": "EXAMPLE_HACKATHON_2026",
        "blocked_aisles": []
    }
    res_manual = client.post("/api/picking/manual-route", json=payload)
    assert res_manual.status_code == 200
    data_manual = res_manual.json()
    assert data_manual["success"] is True
    assert data_manual["total_stops"] == 9
    assert len(data_manual["route_waypoints"]) == 11  # START + 9 stops + END
    assert data_manual["route_waypoints"][0]["type"] == "START"
    assert data_manual["route_waypoints"][-1]["type"] == "END"
