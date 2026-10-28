import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from backend.excel_handler import create_sample_excel_if_not_exists, read_inventory_excel
from backend.cycle_counting import CycleCountEngine
from backend.routing import DistributionRoutingEngine
from backend.picking import SmartPickingEngine

app = FastAPI(
    title="WMS Cycle Counting & Logistics Optimization API - Hackatón Logística 2026",
    description="API para gestión de inventario, conteo cíclico aleatorio y módulo de optimización logística (rutas y picking inteligente).",
    version="2.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize default inventory and engines
default_excel_file = os.path.join(os.path.dirname(__file__), "data", "inventario_maestro.xlsx")
create_sample_excel_if_not_exists(default_excel_file)
initial_references, _ = read_inventory_excel(default_excel_file)

engine = CycleCountEngine(initial_references)
picking_engine = SmartPickingEngine(initial_references)


# --- Pydantic Data Models ---
class RouteRequestModel(BaseModel):
    destination_id: str = Field(..., description="ID del destino satélite (ej. ACACIAS, GRANADA, BOGOTA, YOPAL)")
    cargo_weight_kg: float = Field(5000.0, description="Peso total de la carga en kilogramos")
    vehicle_type: str = Field("CAMION_C2", description="Tipo de vehículo (CAMIONET, CAMION_C2, TRACTOMULA_C3S3)")
    is_demo_data: bool = Field(False, description="Flag para alternar entre datos reales y datos de demostración")


class PickItemRequestModel(BaseModel):
    sku: str
    quantity: int = 1


class OptimizePickRequestModel(BaseModel):
    requested_items: List[PickItemRequestModel]
    layout_id: str = "EXAMPLE_HACKATHON_2026"
    blocked_aisles: Optional[List[str]] = None


class ManualRouteRequestModel(BaseModel):
    location_numbers: List[int]
    layout_id: str = "EXAMPLE_HACKATHON_2026"
    blocked_aisles: Optional[List[str]] = None


class ExportCSVRequestModel(BaseModel):
    dispatch_list: List[Dict[str, Any]]


# --- EXISTING INVENTORY & CYCLE COUNTING ENDPOINTS ---
@app.get("/")
def read_root():
    return {
        "system": "WMS Logística 2026 - Módulo de Optimización",
        "status": "Online",
        "total_references": len(engine.references)
    }


@app.get("/api/inventory")
def get_inventory():
    """Returns the full master list of references along with counting status and statistics."""
    return {
        "references": engine.get_reference_list(),
        "stats": engine.get_summary_stats()
    }


@app.post("/api/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    """Uploads an Excel master inventory file and re-initializes cycle count and picking engines."""
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Solamente se admiten archivos Excel (.xlsx, .xls)")

    contents = await file.read()
    references, msg = read_inventory_excel(contents)

    if not references:
        raise HTTPException(status_code=400, detail=f"No se pudieron extraer referencias del Excel: {msg}")

    global picking_engine
    engine.load_references(references)
    picking_engine = SmartPickingEngine(references)

    return {
        "success": True,
        "message": f"Archivo '{file.filename}' cargado exitosamente. {len(references)} referencias registradas.",
        "stats": engine.get_summary_stats(),
        "references": engine.get_reference_list()
    }


@app.post("/api/cycle-count/generate-week")
def generate_week(seed: Optional[int] = None):
    """Generates the random cycle count schedule for the next week."""
    result = engine.generate_next_week(seed=seed)
    return result


@app.post("/api/cycle-count/simulate-year")
def simulate_year(seed: Optional[int] = None):
    """Simulates random cycle counts for all 52 weeks in sequence."""
    result = engine.simulate_full_year(seed=seed)
    return result


@app.get("/api/cycle-count/schedule")
def get_schedule():
    """Returns the complete 52-week schedule and weekly breakdowns."""
    return {
        "stats": engine.get_summary_stats(),
        "schedule": engine.get_full_schedule(),
        "current_week": engine.current_week
    }


@app.post("/api/cycle-count/reset")
def reset_cycle_count():
    """Resets the cycle count history and week counter back to week 0."""
    engine.reset()
    return {
        "success": True,
        "message": "Conteo cíclico reiniciado correctamente.",
        "stats": engine.get_summary_stats()
    }


# --- TAREA 5: RUTAS DE DISTRIBUCIÓN ENDPOINTS ---
@app.get("/api/logistics/satellites")
def get_satellites():
    """Returns the available satellite destinations and vehicle profiles."""
    dummy_engine = DistributionRoutingEngine()
    return {
        "origin": {
            "id": "VILLAVICENCIO",
            "name": "Almacén Central Villavicencio (Meta)",
            "coordinates": {"lat": 4.1420, "lng": -73.6266}
        },
        "satellites": dummy_engine.get_satellites_list(),
        "vehicles": dummy_engine.get_vehicle_profiles()
    }


@app.post("/api/logistics/routes")
def calculate_distribution_routes(req: RouteRequestModel):
    """Calculates and compares distribution routes from Villavicencio to a satellite destination."""
    routing_engine = DistributionRoutingEngine(is_demo_data=req.is_demo_data)
    result = routing_engine.calculate_routes(
        destination_id=req.destination_id,
        cargo_weight_kg=req.cargo_weight_kg,
        vehicle_type=req.vehicle_type
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Error al calcular rutas."))
    return result


# --- TAREA 6: PICKING INTELIGENTE ENDPOINTS ---
@app.get("/api/picking/example-layout")
def get_example_layout():
    """Returns the faithful Hackathon Example Layout (Orange, Red, Yellow locations)."""
    return picking_engine.get_example_layout()


@app.get("/api/picking/default-racks")
def get_default_racks():
    """Returns the default list of precargados racks with priority colors and levels."""
    return {
        "success": True,
        "default_racks": picking_engine.get_default_priority_racks()
    }


@app.post("/api/picking/manual-route")
def calculate_manual_route(req: ManualRouteRequestModel):
    """Calculates route and waypoints for a manual list of location/rack numbers without requiring SKUs."""
    res = picking_engine.calculate_manual_route(
        location_numbers=req.location_numbers,
        layout_id=req.layout_id,
        blocked_aisles=req.blocked_aisles
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res)
    return res


@app.get("/api/picking/custom-layouts")
def list_custom_layouts():
    """Lists saved custom warehouse layouts."""
    return {
        "custom_layouts": picking_engine.list_custom_layouts()
    }


@app.post("/api/picking/custom-layouts")
def save_custom_layout(layout_data: Dict[str, Any]):
    """Saves a new custom warehouse layout."""
    res = picking_engine.save_custom_layout(layout_data)
    return res


@app.post("/api/picking/optimize-pick")
def optimize_picking(req: OptimizePickRequestModel):
    """Generates an ordered dispatch list and calculated route waypoints."""
    requested_dict = [{"sku": r.sku, "quantity": r.quantity} for r in req.requested_items]
    res = picking_engine.optimize_picking(
        requested_items=requested_dict,
        layout_id=req.layout_id,
        blocked_aisles=req.blocked_aisles
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res)
    return res


@app.post("/api/picking/export-csv")
def export_picking_csv(req: ExportCSVRequestModel):
    """Generates and returns CSV string of ordered dispatch list."""
    csv_content = picking_engine.export_dispatch_list_csv(req.dispatch_list)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=lista_de_despacho_ordenada.csv"}
    )
