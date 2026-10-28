import os
import io
import pandas as pd
from typing import List, Dict, Any, Tuple

DEFAULT_EXCEL_PATH = os.path.join(os.path.dirname(__file__), "inventario_maestro.xlsx")

def create_sample_excel_if_not_exists(filepath: str = DEFAULT_EXCEL_PATH) -> str:
    """Generates a default inventory master Excel file with realistic logistics data."""
    if os.path.exists(filepath):
        return filepath

    data = [
        {"SKU": "REF-1001", "Descripción": "Empaque Metálico A1", "Categoría ABC": "A", "Ubicación": "Pasillo A - Estante 01", "Stock": 1200, "Costo Unitario ($)": 45.50},
        {"SKU": "REF-1002", "Descripción": "Motor Eléctrico 0.5HP", "Categoría ABC": "A", "Ubicación": "Pasillo A - Estante 02", "Stock": 350, "Costo Unitario ($)": 280.00},
        {"SKU": "REF-1003", "Descripción": "Rodamiento Industrial 6205", "Categoría ABC": "A", "Ubicación": "Pasillo A - Estante 03", "Stock": 2500, "Costo Unitario ($)": 15.20},
        {"SKU": "REF-1004", "Descripción": "Válvula Hidráulica 3/4", "Categoría ABC": "A", "Ubicación": "Pasillo A - Estante 04", "Stock": 420, "Costo Unitario ($)": 110.00},
        {"SKU": "REF-1005", "Descripción": "Sensor Optico Reflectivo", "Categoría ABC": "A", "Ubicación": "Pasillo A - Estante 05", "Stock": 800, "Costo Unitario ($)": 65.00},
        {"SKU": "REF-1006", "Descripción": "PLC Controlador M221", "Categoría ABC": "A", "Ubicación": "Pasillo A - Estante 06", "Stock": 150, "Costo Unitario ($)": 450.00},
        {"SKU": "REF-1007", "Descripción": "Caja de Cartón Doble Corrugado", "Categoría ABC": "B", "Ubicación": "Pasillo B - Estante 01", "Stock": 5000, "Costo Unitario ($)": 2.10},
        {"SKU": "REF-1008", "Descripción": "Cinta Embalaje 48mm x 100m", "Categoría ABC": "B", "Ubicación": "Pasillo B - Estante 02", "Stock": 3200, "Costo Unitario ($)": 1.80},
        {"SKU": "REF-1009", "Descripción": "Film Stretch 20 micras", "Categoría ABC": "B", "Ubicación": "Pasillo B - Estante 03", "Stock": 1800, "Costo Unitario ($)": 12.50},
        {"SKU": "REF-1010", "Descripción": "Filtro Aceite Hidráulico", "Categoría ABC": "B", "Ubicación": "Pasillo B - Estante 04", "Stock": 640, "Costo Unitario ($)": 28.00},
        {"SKU": "REF-1011", "Descripción": "Correa de Transmisión A-42", "Categoría ABC": "B", "Ubicación": "Pasillo B - Estante 05", "Stock": 950, "Costo Unitario ($)": 8.90},
        {"SKU": "REF-1012", "Descripción": "Manguera Neumática 8mm", "Categoría ABC": "B", "Ubicación": "Pasillo B - Estante 06", "Stock": 2100, "Costo Unitario ($)": 4.30},
        {"SKU": "REF-1013", "Descripción": "Abrazadera Inoxidable 1 pulg", "Categoría ABC": "C", "Ubicación": "Pasillo C - Estante 01", "Stock": 8500, "Costo Unitario ($)": 0.75},
        {"SKU": "REF-1014", "Descripción": "Tornillo Grado 8 3/8x2", "Categoría ABC": "C", "Ubicación": "Pasillo C - Estante 02", "Stock": 12000, "Costo Unitario ($)": 0.30},
        {"SKU": "REF-1015", "Descripción": "Tuerca de Seguridad M8", "Categoría ABC": "C", "Ubicación": "Pasillo C - Estante 03", "Stock": 15000, "Costo Unitario ($)": 0.15},
        {"SKU": "REF-1016", "Descripción": "Arandela Plana 3/8", "Categoría ABC": "C", "Ubicación": "Pasillo C - Estante 04", "Stock": 20000, "Costo Unitario ($)": 0.08},
        {"SKU": "REF-1017", "Descripción": "Conector Rápido Neumático", "Categoría ABC": "C", "Ubicación": "Pasillo C - Estante 05", "Stock": 3100, "Costo Unitario ($)": 2.40},
        {"SKU": "REF-1018", "Descripción": "Etiqueta Térmica 100x150mm", "Categoría ABC": "C", "Ubicación": "Pasillo C - Estante 06", "Stock": 10000, "Costo Unitario ($)": 0.05},
        {"SKU": "REF-1019", "Descripción": "Bomba de Agua Centrífuga", "Categoría ABC": "A", "Ubicación": "Pasillo A - Estante 07", "Stock": 210, "Costo Unitario ($)": 310.00},
        {"SKU": "REF-1020", "Descripción": "Transformador 220V/24V", "Categoría ABC": "B", "Ubicación": "Pasillo B - Estante 07", "Stock": 430, "Costo Unitario ($)": 55.00},
    ]

    df = pd.DataFrame(data)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    df.to_excel(filepath, index=False, engine='openpyxl')
    return filepath


def read_inventory_excel(file_source: Any) -> Tuple[List[Dict[str, Any]], str]:
    """
    Reads an inventory Excel file (path, file object or bytes) and normalizes columns.
    Returns (list_of_references, status_message).
    """
    try:
        if isinstance(file_source, bytes):
            file_source = io.BytesIO(file_source)
        df = pd.read_excel(file_source, engine='openpyxl')
    except Exception as e:
        return [], f"Error al leer el archivo Excel: {str(e)}"

    if df.empty:
        return [], "El archivo Excel está vacío."

    # Column mappings for flexibility
    col_map = {}
    for col in df.columns:
        c_clean = str(col).strip().lower()
        if any(term in c_clean for term in ["sku", "referencia", "codigo", "ref"]):
            col_map[col] = "sku"
        elif any(term in c_clean for term in ["descrip", "nombre", "item", "producto"]):
            col_map[col] = "description"
        elif any(term in c_clean for term in ["abc", "categor", "clase"]):
            col_map[col] = "category"
        elif any(term in c_clean for term in ["ubicaci", "location", "posicion", "rack", "estante"]):
            col_map[col] = "location"
        elif any(term in c_clean for term in ["stock", "cantidad", "qty", "inventario"]):
            col_map[col] = "stock"
        elif any(term in c_clean for term in ["costo", "precio", "valor", "cost"]):
            col_map[col] = "unit_cost"

    # Rename matched columns
    df = df.rename(columns=col_map)

    # Ensure sku column exists or use index
    if "sku" not in df.columns:
        df["sku"] = [f"REF-{i+1001}" for i in range(len(df))]

    # Default missing standard columns if not present
    if "description" not in df.columns:
        df["description"] = "Ítem sin descripción"
    if "category" not in df.columns:
        df["category"] = "B"
    if "location" not in df.columns:
        df["location"] = "Ubicación General"
    if "stock" not in df.columns:
        df["stock"] = 0
    if "unit_cost" not in df.columns:
        df["unit_cost"] = 0.0

    # Sanitize data types and handle missing values
    df["sku"] = df["sku"].astype(str).str.strip()
    df["description"] = df["description"].astype(str).str.strip()
    df["category"] = df["category"].astype(str).str.strip().str.upper()
    df["location"] = df["location"].astype(str).str.strip()
    df["stock"] = pd.to_numeric(df["stock"], errors='coerce').fillna(0).astype(int)
    df["unit_cost"] = pd.to_numeric(df["unit_cost"], errors='coerce').fillna(0.0).round(2)

    references = df[["sku", "description", "category", "location", "stock", "unit_cost"]].to_dict(orient="records")
    return references, "Excel procesado exitosamente"
