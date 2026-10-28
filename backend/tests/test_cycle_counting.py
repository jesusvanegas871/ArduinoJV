import os
import pytest
from fastapi.testclient import TestClient

from backend.excel_handler import create_sample_excel_if_not_exists, read_inventory_excel
from backend.cycle_counting import CycleCountEngine
from backend.main import app

def test_excel_handler(tmp_path):
    excel_file = os.path.join(tmp_path, "test_inventario.xlsx")
    created_path = create_sample_excel_if_not_exists(excel_file)
    assert os.path.exists(created_path)

    refs, msg = read_inventory_excel(created_path)
    assert "exitosamente" in msg.lower()
    assert len(refs) == 20
    assert "sku" in refs[0]
    assert "category" in refs[0]

def test_cycle_count_engine_5_counts_constraint():
    sample_refs = [
        {"sku": f"REF-{i}", "description": f"Item {i}", "category": "A", "location": "Pasillo A", "stock": 100, "unit_cost": 10.0}
        for i in range(1, 11)
    ]
    engine = CycleCountEngine(sample_refs)

    # Initially 0 counts
    for ref in engine.get_reference_list():
        assert ref["counts_completed"] == 0
        assert ref["is_blocked"] is False

    # Simulate full 52 weeks
    res = engine.simulate_full_year(seed=123)
    assert res["success"] is True

    refs = engine.get_reference_list()
    assert len(refs) == 10

    # Every reference MUST be counted exactly 5 times and blocked
    for ref in refs:
        assert ref["counts_completed"] == 5, f"SKU {ref['sku']} count is {ref['counts_completed']}, expected 5"
        assert ref["is_blocked"] is True, f"SKU {ref['sku']} should be blocked after 5 counts"

    # Total counts must be exactly 10 items * 5 counts = 50
    stats = engine.get_summary_stats()
    assert stats["total_scheduled_counts"] == 50
    assert stats["completion_percentage"] == 100.0

def test_no_extra_counts_allowed():
    sample_refs = [{"sku": "REF-100", "description": "Item Solo", "category": "A", "location": "P1", "stock": 10, "unit_cost": 5.0}]
    engine = CycleCountEngine(sample_refs)

    engine.simulate_full_year()

    # Attempting to generate week 53 or extra step should fail or produce 0 counts
    res = engine.generate_next_week()
    assert res["success"] is False or len(res["selected_skus"]) == 0

    ref = engine.get_reference_list()[0]
    assert ref["counts_completed"] == 5
    assert ref["is_blocked"] is True

def test_fastapi_endpoints():
    client = TestClient(app)

    # Get inventory
    res = client.get("/api/inventory")
    assert res.status_code == 200
    data = res.json()
    assert "references" in data
    assert "stats" in data

    # Reset
    res = client.post("/api/cycle-count/reset")
    assert res.status_code == 200
    assert res.json()["stats"]["current_week"] == 0

    # Generate next week
    res = client.post("/api/cycle-count/generate-week")
    assert res.status_code == 200
    assert res.json()["week"] == 1

    # Simulate full year
    res = client.post("/api/cycle-count/simulate-year")
    assert res.status_code == 200
    assert res.json()["stats"]["completion_percentage"] == 100.0
