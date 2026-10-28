import os
import io
import pandas as pd
from typing import List, Dict, Any, Tuple
from io import BytesIO

DEFAULT_EXCEL_PATH = os.path.join(os.path.dirname(__file__), "DATA FINAL ENTREGAR2026.xlsx")

def create_sample_excel_if_not_exists(filepath: str = DEFAULT_EXCEL_PATH) -> str:
    """Genera un archivo de respaldo si no existe."""
    if os.path.exists(filepath):
        return filepath

    parent_dir = os.path.dirname(filepath)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)

    sample_data = []
    for i in range(1, 21):
        sample_data.append({
            "CODIGO": f"SKU-{1000 + i}",
            "DESCRIPCIÓN": f"Producto de Prueba {i}",
            "CATEGORIA": "Categoría A" if i % 2 == 0 else "Categoría B"
        })

    df = pd.DataFrame(sample_data)
    with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="PRODUCTOS A INCLUIR", startrow=3, index=False)

    return filepath

def read_inventory_excel(file_source: Any) -> Tuple[List[Dict[str, Any]], str]:
    """
    Lee el archivo Excel y extrae ÚNICAMENTE las referencias maestras únicas,
    evitando que se muestren las miles de filas de transacciones de ventas.
    """
    try:
        if isinstance(file_source, bytes):
            file_source = io.BytesIO(file_source)

        xl = pd.ExcelFile(file_source)
        
        # 1. Priorizar la hoja 'PRODUCTOS A INCLUIR' si existe
        df_prod = pd.DataFrame()
        if 'PRODUCTOS A INCLUIR' in xl.sheet_names:
            df_prod = pd.read_excel(xl, sheet_name='PRODUCTOS A INCLUIR', header=3)

        # 2. Leer la hoja 'DATA VENTAS'
        df_ventas = pd.DataFrame()
        if 'DATA VENTAS' in xl.sheet_names:
            df_ventas = pd.read_excel(xl, sheet_name='DATA VENTAS', header=2)

    except Exception as e:
        return [], f"Error al leer el archivo Excel: {str(e)}"

    references = []
    seen_skus = set()

    # Si tenemos la hoja de productos a incluir, la procesamos primero
    if not df_prod.empty and 'CODIGO' in df_prod.columns:
        df_prod = df_prod.dropna(subset=['CODIGO'])
        for _, row in df_prod.iterrows():
            sku = str(row.get('CODIGO', '')).strip()
            if not sku or sku.lower() == 'nan' or sku in seen_skus:
                continue
            seen_skus.add(sku)
            
            desc = str(row.get('DESCRIPCIÓN', 'Sin descripción')).strip()
            cat = str(row.get('CATEGORIA', 'General')).strip()
            
            references.append({
                "sku": sku,
                "description": desc if desc and desc != "nan" else "Ítem sin descripción",
                "category": cat if cat and cat != "nan" else "General",
                "location": f"Pasillo Principal - Estante {sku[-2:] if len(sku)>=2 else '01'}",
                "stock": 250,
                "unit_cost": 85.00
            })

    # Extraer referencias ÚNICAS de la hoja de ventas (evitando que se repitan las 19,000 filas)
    if not df_ventas.empty:
        col_codigo = next((c for c in df_ventas.columns if 'codigo' in str(c).lower()), df_ventas.columns[4] if len(df_ventas.columns) > 4 else None)
        col_desc = next((c for c in df_ventas.columns if 'descrip' in str(c).lower()), df_ventas.columns[5] if len(df_ventas.columns) > 5 else None)
        col_costo = next((c for c in df_ventas.columns if 'valor unitario' in str(c).lower()), df_ventas.columns[12] if len(df_ventas.columns) > 12 else None)

        if col_codigo is not None:
            # AQUÍ ESTÁ LA CLAVE: drop_duplicates para quedarnos SOLO con las referencias únicas
            df_unique = df_ventas.drop_duplicates(subset=[col_codigo]).copy()
            
            for _, row in df_unique.iterrows():
                sku = str(row[col_codigo]).strip()
                if not sku or sku.lower() == 'nan' or sku in seen_skus:
                    continue
                seen_skus.add(sku)
                
                desc = str(row[col_desc]).strip() if col_desc and pd.notna(row[col_desc]) else "Ítem de Distribuidora"
                costo = float(row[col_costo]) if col_costo and pd.notna(row[col_costo]) else 50.0
                
                references.append({
                    "sku": sku,
                    "description": desc if desc != "nan" else "Ítem sin descripción",
                    "category": "Catálogo General",
                    "location": f"Bodega Central - Rack {sku[-2:] if len(sku)>=2 else '01'}",
                    "stock": 150,
                    "unit_cost": round(costo, 2)
                })

    if not references:
        return [], "No se pudieron extraer referencias únicas del archivo Excel."

    return references, f"Excel procesado exitosamente. Se cargaron exactamente {len(references)} referencias únicas."