import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from backend.excel_handler import create_sample_excel_if_not_exists, read_inventory_excel
from backend.cycle_counting import CycleCountEngine

app = FastAPI(
    title="WMS Cycle Counting API - Hackatón Logística 2026",
    description="API robusta para la gestión e inventario cíclico aleatorio restringido a 5 conteos anuales por referencia.",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize default inventory and cycle counting engine
default_excel_file = os.path.join(os.path.dirname(__file__), "data", "inventario_maestro.xlsx")
create_sample_excel_if_not_exists(default_excel_file)
initial_references, _ = read_inventory_excel(default_excel_file)

engine = CycleCountEngine(initial_references)


@app.get("/")
def read_root():
    return {
        "system": "WMS Cycle Counting - Hackatón Logística 2026",
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
    """Uploads an Excel master inventory file and re-initializes the cycle count engine."""
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Solamente se admiten archivos Excel (.xlsx, .xls)")

    contents = await file.read()
    references, msg = read_inventory_excel(contents)

    if not references:
        raise HTTPException(status_code=400, detail=f"No se pudieron extraer referencias del Excel: {msg}")

    engine.load_references(references)

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
