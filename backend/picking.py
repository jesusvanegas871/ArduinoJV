import csv
import io
import math
from typing import Dict, List, Any, Optional

# EXAMPLE LAYOUT MANDATORY DEFINITION (Hackathon Reference Layout)
# 60 locations arranged across 4 main Aisles (Pasillo 1 to Pasillo 4), 6 Racks (R1 to R6)
# Special Colored Locations with Structured Data:
# - Orange (#f97316): Locations 4, 25, 60 (Levels 1 and 2)
# - Red (#ef4444): Locations 41, 44, 49 (Level 2)
# - Yellow (#eab308): Locations 7, 21, 55 (Level 1)
# - Bottom Exits / Entrances at row Y=0

ORANGE_LOCATIONS = {4, 25, 60}
RED_LOCATIONS = {41, 44, 49}
YELLOW_LOCATIONS = {7, 21, 55}

def build_example_layout() -> Dict[str, Any]:
    """
    Builds the faithful Example Layout matching original Hackathon specification.
    Includes structured location data for colors, levels, racks, aisles, and coordinates.
    """
    locations = {}
    total_locations = 60

    # Grid layout parameters
    # 4 Aisles (Pasillo 1 to Pasillo 4)
    # 6 Racks (R1 to R6) - Double sided
    # Bottom Exits at (x=2, y=0) and (x=6, y=0)

    for loc_num in range(1, total_locations + 1):
        loc_id = str(loc_num)

        # Determine Aisle and Quadrant
        # 1-15: Pasillo 1 (Cuadrante Q1 - Norte/Sur)
        # 16-30: Pasillo 2 (Cuadrante Q2 - Norte/Sur)
        # 31-45: Pasillo 3 (Cuadrante Q3 - Norte/Sur)
        # 46-60: Pasillo 4 (Cuadrante Q4 - Norte/Sur)

        if loc_num <= 15:
            aisle_num = 1
            quadrant = "Q1 (Cuadrante Suroeste)"
            x_coord = 2
            y_coord = loc_num
            rack_id = f"R1-A{(loc_num % 2) + 1}"
        elif loc_num <= 30:
            aisle_num = 2
            quadrant = "Q2 (Cuadrante Noroeste)"
            x_coord = 5
            y_coord = loc_num - 15
            rack_id = f"R2-B{(loc_num % 2) + 1}"
        elif loc_num <= 45:
            aisle_num = 3
            quadrant = "Q3 (Cuadrante Noreste)"
            x_coord = 8
            y_coord = loc_num - 30
            rack_id = f"R3-C{(loc_num % 2) + 1}"
        else:
            aisle_num = 4
            quadrant = "Q4 (Cuadrante Sureste)"
            x_coord = 11
            y_coord = loc_num - 45
            rack_id = f"R4-D{(loc_num % 2) + 1}"

        # Structured color and level semantics
        if loc_num in ORANGE_LOCATIONS:
            color = "orange"
            color_hex = "#f97316"
            levels = [1, 2]
            picking_rule = "Recogida de productos en dos niveles (Primer y Segundo Nivel)"
            description = "Ubicación Naranja de Alta Prioridad / Doble Nivel"
        elif loc_num in RED_LOCATIONS:
            color = "red"
            color_hex = "#ef4444"
            levels = [2]
            picking_rule = "Recogida de productos únicamente en Segundo Nivel (Nivel Superior)"
            description = "Ubicación Roja - Requiere Montacargas / Altura Nivel 2"
        elif loc_num in YELLOW_LOCATIONS:
            color = "yellow"
            color_hex = "#eab308"
            levels = [1]
            picking_rule = "Recogida de productos únicamente en Primer Nivel (Nivel Base)"
            description = "Ubicación Amarilla - Picking Manual Nivel 1"
        else:
            color = "slate"
            color_hex = "#334155"
            levels = [1]
            picking_rule = "Recogida Estándar Nivel 1"
            description = "Ubicación Estándar de Almacén"

        locations[loc_id] = {
            "id": loc_id,
            "number": loc_num,
            "rack": rack_id,
            "aisle": f"Pasillo {aisle_num}",
            "aisle_number": aisle_num,
            "quadrant": quadrant,
            "color": color,
            "color_hex": color_hex,
            "levels": levels,
            "picking_rule": picking_rule,
            "description": description,
            "grid_x": x_coord,
            "grid_y": y_coord,
            "assigned_skus": []
        }

    # Standard exit points at bottom
    exits = [
        {"id": "EXIT-1", "name": "Salida / Despacho Inferior Izquierdo", "grid_x": 2, "grid_y": 0},
        {"id": "EXIT-2", "name": "Salida / Despacho Inferior Derecho", "grid_x": 8, "grid_y": 0}
    ]

    return {
        "layout_id": "EXAMPLE_HACKATHON_2026",
        "name": "Layout de Ejemplo Obligatorio (Hackatón 2026)",
        "is_custom": False,
        "total_locations": total_locations,
        "aisles_count": 4,
        "grid_dimensions": {"rows": 16, "cols": 14},
        "exits": exits,
        "locations": locations
    }


# CUSTOM LAYOUTS STORAGE (In-memory store + default backup)
CUSTOM_LAYOUTS_STORE: Dict[str, Dict[str, Any]] = {}


class SmartPickingEngine:
    """
    Core engine for Smart Picking Optimization (Picking Inteligente).
    Handles layout mapping, route optimization (S-Shape / Quadrant-Aisle heuristic),
    distance calculations, validations, and CSV exports.
    """

    def __init__(self, inventory_references: List[Dict[str, Any]]):
        self.inventory: Dict[str, Dict[str, Any]] = {
            str(item["sku"]).strip(): item for item in inventory_references
        }
        self.example_layout = build_example_layout()
        self._map_skus_to_example_layout()

    def _map_skus_to_example_layout(self):
        """Deterministically assigns inventory SKUs to layout locations."""
        skus = list(self.inventory.keys())
        loc_keys = sorted(list(self.example_layout["locations"].keys()), key=lambda k: int(k))

        for idx, sku in enumerate(skus):
            target_loc_id = loc_keys[idx % len(loc_keys)]
            self.example_layout["locations"][target_loc_id]["assigned_skus"].append(sku)
            self.inventory[sku]["location_id"] = target_loc_id
            self.inventory[sku]["aisle"] = self.example_layout["locations"][target_loc_id]["aisle"]
            self.inventory[sku]["rack"] = self.example_layout["locations"][target_loc_id]["rack"]

    def get_example_layout(self) -> Dict[str, Any]:
        return self.example_layout

    def save_custom_layout(self, layout_data: Dict[str, Any]) -> Dict[str, Any]:
        layout_id = layout_data.get("layout_id", f"CUSTOM_{len(CUSTOM_LAYOUTS_STORE) + 1}")
        layout_data["layout_id"] = layout_id
        layout_data["is_custom"] = True
        CUSTOM_LAYOUTS_STORE[layout_id] = layout_data
        return {
            "success": True,
            "message": f"Layout personalizado '{layout_data.get('name', layout_id)}' guardado correctamente.",
            "layout_id": layout_id
        }

    def get_custom_layout(self, layout_id: str) -> Optional[Dict[str, Any]]:
        return CUSTOM_LAYOUTS_STORE.get(layout_id)

    def list_custom_layouts(self) -> List[Dict[str, Any]]:
        return [
            {
                "layout_id": k,
                "name": v.get("name", k),
                "total_locations": len(v.get("locations", {})),
                "is_custom": True
            }
            for k, v in CUSTOM_LAYOUTS_STORE.items()
        ]

    def optimize_picking(
        self,
        requested_items: List[Dict[str, Any]],  # [{"sku": "SKU-1", "quantity": 5}, ...]
        layout_id: str = "EXAMPLE_HACKATHON_2026",
        blocked_aisles: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generates an ordered dispatch list to minimize operator traversal distance.
        Groups items by quadrant and aisle, considers picking levels (Level 1 vs Level 2),
        validates stock & blocked aisles, and calculates distance comparison.
        """
        blocked_aisles_set = set(blocked_aisles or [])
        layout = self.example_layout if layout_id == "EXAMPLE_HACKATHON_2026" else CUSTOM_LAYOUTS_STORE.get(layout_id, self.example_layout)
        loc_map = layout["locations"]

        errors = []
        warnings = []
        picking_items = []

        # 1. VALIDATIONS
        for req in requested_items:
            sku = str(req.get("sku", "")).strip()
            qty = int(req.get("quantity", 1))

            if sku not in self.inventory:
                errors.append(f"El SKU '{sku}' no existe en el maestro de inventario.")
                continue

            inv_item = self.inventory[sku]

            # Stock check
            if inv_item.get("stock", 0) < qty:
                errors.append(f"Stock insuficiente para SKU '{sku}'. Solicitado: {qty}, Disponible: {inv_item.get('stock', 0)}.")
                continue

            # Location check
            loc_id = inv_item.get("location_id")
            if not loc_id or loc_id not in loc_map:
                # Fallback to search loc_map
                loc_id = next((lid for lid, loc in loc_map.items() if sku in loc.get("assigned_skus", [])), None)

            if not loc_id or loc_id not in loc_map:
                errors.append(f"El SKU '{sku}' no tiene una ubicación asignada en el layout seleccionado.")
                continue

            loc_data = loc_map[loc_id]

            # Blocked aisle check
            if loc_data.get("aisle") in blocked_aisles_set:
                warnings.append(f"El pasillo '{loc_data.get('aisle')}' para la ubicación {loc_id} está bloqueado. El recorrido requerirá desvío especial.")

            # Pick level logic
            levels_available = loc_data.get("levels", [1])
            chosen_level = levels_available[0] if len(levels_available) == 1 else 1  # Standard primary level

            picking_items.append({
                "sku": sku,
                "description": inv_item.get("description", "Sin descripción"),
                "quantity": qty,
                "location_id": loc_id,
                "location_number": loc_data.get("number", loc_id),
                "aisle": loc_data.get("aisle", "Pasillo 1"),
                "aisle_number": loc_data.get("aisle_number", 1),
                "rack": loc_data.get("rack", "R1"),
                "quadrant": loc_data.get("quadrant", "Q1"),
                "color": loc_data.get("color", "slate"),
                "color_hex": loc_data.get("color_hex", "#334155"),
                "levels": levels_available,
                "chosen_level": chosen_level,
                "level_display": "Nivel 1 y 2" if len(levels_available) > 1 else f"Nivel {chosen_level}",
                "grid_x": loc_data.get("grid_x", 0),
                "grid_y": loc_data.get("grid_y", 0),
                "picked": False
            })

        if errors:
            return {
                "success": False,
                "errors": errors,
                "warnings": warnings,
                "message": "Validación fallida: existen errores en la solicitud de picking."
            }

        if not picking_items:
            return {
                "success": False,
                "message": "No se ingresaron ítems válidos para generar la lista de despacho."
            }

        # 2. ORIGINAL VS OPTIMIZED ROUTE ALGORITHM
        # Original Sequence: Unsorted as requested by operator
        original_sequence = list(picking_items)
        original_distance_m = self._calculate_route_distance(original_sequence, blocked_aisles_set)

        # Optimized Sequence: S-Shape Aisle Traversal Heuristic
        # Sort key: Quadrant -> Aisle Number -> Directional S-Shape (alternating Y coordinate) -> Level
        optimized_sequence = self._sort_picking_s_shape(picking_items, blocked_aisles_set)

        # Assign pick order index 1..N
        for idx, item in enumerate(optimized_sequence, start=1):
            item["pick_order"] = idx

        optimized_distance_m = self._calculate_route_distance(optimized_sequence, blocked_aisles_set)

        # Build Waypoints for canvas visual drawing
        route_waypoints = self._build_canvas_waypoints(optimized_sequence)

        return {
            "success": True,
            "message": f"Lista de despacho generada con éxito. {len(optimized_sequence)} ítems ordenados.",
            "layout_id": layout_id,
            "warnings": warnings,
            "total_items": len(optimized_sequence),
            "dispatch_list": optimized_sequence,
            "distance_comparison": {
                "original_sequence_distance_m": round(original_distance_m, 1),
                "optimized_sequence_distance_m": round(optimized_distance_m, 1),
                "distance_saved_m": round(max(0, original_distance_m - optimized_distance_m), 1),
                "methodology_disclaimer": "Distancias reales calculadas mediante heurística S-Shape de recorrido de pasillos. No representa óptimo global teórico en problemas NP-hard."
            },
            "route_waypoints": route_waypoints
        }

    def _sort_picking_s_shape(
        self,
        items: List[Dict[str, Any]],
        blocked_aisles: set
    ) -> List[Dict[str, Any]]:
        """
        S-Shape Aisle Routing Heuristic:
        Groups by Aisle. Alternates direction (ascending vs descending Y) per aisle to create continuous S-curve.
        """
        # Group items by aisle_number
        aisles_map: Dict[int, List[Dict[str, Any]]] = {}
        for item in items:
            a_num = item["aisle_number"]
            aisles_map.setdefault(a_num, []).append(item)

        sorted_aisles = sorted(aisles_map.keys())
        optimized_list = []

        for idx, a_num in enumerate(sorted_aisles):
            aisle_items = aisles_map[a_num]
            # S-shape logic: Even index aisles go bottom-to-top (asc Y), odd go top-to-bottom (desc Y)
            if idx % 2 == 0:
                aisle_items.sort(key=lambda x: (x["grid_y"], x["chosen_level"]))
            else:
                aisle_items.sort(key=lambda x: (-x["grid_y"], x["chosen_level"]))

            optimized_list.extend(aisle_items)

        return optimized_list

    def _calculate_route_distance(
        self,
        sequence: List[Dict[str, Any]],
        blocked_aisles: set
    ) -> float:
        """
        Calculates total grid Manhattan/Euclidean distance in meters (1 grid unit = 2.5 meters).
        Adds penalty distance for detour if an aisle is blocked.
        """
        if not sequence:
            return 0.0

        grid_to_meters = 2.5
        current_x, current_y = 2, 0  # Starting at Entrance/Exit 1
        total_dist_grid = 0.0

        for item in sequence:
            target_x = item["grid_x"]
            target_y = item["grid_y"]

            # Base Manhattan distance
            dx = abs(target_x - current_x)
            dy = abs(target_y - current_y)
            dist = dx + dy

            # Blocked aisle penalty (detour around top or bottom of rack)
            if item["aisle"] in blocked_aisles:
                dist += 12.0  # Penalty units for detour

            total_dist_grid += dist
            current_x, current_y = target_x, target_y

        # Return to exit point (2, 0)
        total_dist_grid += (abs(current_x - 2) + abs(current_y - 0))
        return total_dist_grid * grid_to_meters

    def _build_canvas_waypoints(self, sequence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generates waypoint coordinates with enriched metadata for rendering animated AGV routes."""
        waypoints = [{
            "step": 0,
            "type": "START",
            "x": 2,
            "y": 0,
            "zone": "Zona Inferior de Entrada / Despacho",
            "audio_tag": "start",
            "label": "Punto de Inicio / Despacho"
        }]

        for idx, item in enumerate(sequence, start=1):
            color = item.get("color", "slate")
            waypoints.append({
                "step": idx,
                "type": "PICK",
                "x": item["grid_x"],
                "y": item["grid_y"],
                "sku": item["sku"],
                "location": item["location_number"],
                "aisle": item.get("aisle", "Pasillo 1"),
                "rack": item.get("rack", "R1"),
                "quadrant": item.get("quadrant", "Q1"),
                "color": color,
                "chosen_level": item.get("chosen_level", 1),
                "dwell_time_ms": 1500 if color == "red" else (1200 if color == "orange" else 1000),
                "audio_tag": f"pick_{color}",
                "label": f"#{idx} SKU {item['sku']} (Ubicación #{item['location_number']}, {item.get('level_display', 'Nivel 1')})"
            })

        waypoints.append({
            "step": len(sequence) + 1,
            "type": "END",
            "x": 2,
            "y": 0,
            "zone": "Zona Inferior de Entrada / Despacho",
            "audio_tag": "end",
            "label": "Retorno a Despacho / Zona Inferior"
        })

        return waypoints

    def export_dispatch_list_csv(self, dispatch_list: List[Dict[str, Any]]) -> str:
        """Generates a CSV string representing the ordered dispatch list."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "Orden Recogida", "SKU", "Descripción", "Cantidad",
            "Ubicación", "Pasillo", "Rack", "Nivel", "Cuadrante"
        ])

        for item in dispatch_list:
            writer.writerow([
                item.get("pick_order", 1),
                item.get("sku", ""),
                item.get("description", ""),
                item.get("quantity", 1),
                item.get("location_number", ""),
                item.get("aisle", ""),
                item.get("rack", ""),
                item.get("level_display", ""),
                item.get("quadrant", "")
            ])

        return output.getvalue()
