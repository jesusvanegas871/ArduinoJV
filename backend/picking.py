import csv
import io
import math
from typing import Dict, List, Any, Optional

# EXAMPLE LAYOUT MANDATORY DEFINITION (Hackathon Reference Layout)
# 60 locations arranged across 4 main Aisles (Pasillo 1 to Pasillo 4), 6 Racks (R1 to R6)
# Special Colored Locations with Structured Data:
# - Orange (#f97316): Locations 4, 25, 60 (Levels 1 and 2) -> Mandatory Double Stop
# - Red (#ef4444): Locations 41, 44, 49 (Level 2)
# - Yellow (#eab308): Locations 7, 21, 55 (Level 1)
# - Bottom Exits / Entrances at row Y=0

ORANGE_LOCATIONS = {4, 25, 60}
RED_LOCATIONS = {41, 44, 49}
YELLOW_LOCATIONS = {7, 21, 55}

# Blueprint Physical Measurements (Metros)
BLUEPRINT_PARAMS = {
    "aisle_width_m": 1.0,           # Pasillos de 1m
    "rack_separation_m": 2.4,       # Separación entre pasillos de racks = 2.4m (3 grid_x units)
    "grid_x_unit_m": 0.8,           # 2.4m / 3 unidades = 0.8m por unidad x
    "grid_y_unit_m": 1.0,           # Separación entre posiciones de rack = 1.0m por unidad y
    "bottom_corridor_depth_m": 5.0, # Zona de salida/entrada inferior de 5m
    "top_corridor_depth_m": 3.0,    # Zona de paso/tránsito superior de 3m
}


def build_example_layout() -> Dict[str, Any]:
    """
    Builds the faithful Example Layout matching original Hackathon specification.
    Includes structured location data for colors, levels, racks, aisles, and coordinates.
    """
    locations = {}
    total_locations = 60

    for loc_num in range(1, total_locations + 1):
        loc_id = str(loc_num)

        # Determine Aisle and Quadrant
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
            picking_rule = "Doble Parada Obligatoria: Recogida en Primer Nivel (Niv. 1) y Segundo Nivel (Niv. 2)"
            description = "Ubicación Naranja de Alta Prioridad / Doble Parada Multi-nivel"
        elif loc_num in RED_LOCATIONS:
            color = "red"
            color_hex = "#ef4444"
            levels = [2]
            picking_rule = "Recogida únicamente en Segundo Nivel (Nivel Superior - Altura)"
            description = "Ubicación Roja - Requiere Montacargas / Altura Nivel 2"
        elif loc_num in YELLOW_LOCATIONS:
            color = "yellow"
            color_hex = "#eab308"
            levels = [1]
            picking_rule = "Recogida únicamente en Primer Nivel (Nivel Base)"
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
    real blueprint distance calculations, multi-level stops, validations, and CSV exports.
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

    def get_default_priority_racks(self) -> List[Dict[str, Any]]:
        """Returns the precargados racks list matching the exact layout priority colors and levels."""
        default_ids = [4, 7, 21, 25, 41, 44, 49, 55, 60]
        loc_map = self.example_layout["locations"]
        result = []
        for loc_num in default_ids:
            loc_id = str(loc_num)
            if loc_id in loc_map:
                loc_data = loc_map[loc_id]
                levels = loc_data.get("levels", [1])
                level_disp = "1er y 2do nivel (Doble Parada)" if len(levels) > 1 else ("1er nivel" if levels[0] == 1 else "2do nivel")
                result.append({
                    "location_number": loc_data["number"],
                    "rack": loc_data["rack"],
                    "aisle": loc_data["aisle"],
                    "aisle_number": loc_data["aisle_number"],
                    "quadrant": loc_data["quadrant"],
                    "color": loc_data["color"],
                    "color_hex": loc_data["color_hex"],
                    "levels": levels,
                    "level_display": level_disp,
                    "picking_rule": loc_data["picking_rule"],
                    "description": loc_data["description"],
                    "grid_x": loc_data["grid_x"],
                    "grid_y": loc_data["grid_y"]
                })
        return result

    def calculate_manual_route(
        self,
        location_numbers: List[int],
        layout_id: str = "EXAMPLE_HACKATHON_2026",
        blocked_aisles: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Calculates manual route for a sequence of rack/location IDs with multi-level stop enforcement."""
        blocked_aisles_set = set(blocked_aisles or [])
        layout = self.example_layout if layout_id == "EXAMPLE_HACKATHON_2026" else CUSTOM_LAYOUTS_STORE.get(layout_id, self.example_layout)
        loc_map = layout["locations"]

        errors = []
        warnings = []
        stops = []

        for loc_num in location_numbers:
            loc_id = str(loc_num)
            if loc_id not in loc_map:
                errors.append(f"La ubicación #{loc_num} no existe en el layout de almacén.")
                continue

            loc_data = loc_map[loc_id]

            if loc_data.get("aisle") in blocked_aisles_set:
                warnings.append(f"El pasillo '{loc_data.get('aisle')}' para la ubicación #{loc_num} está bloqueado.")

            levels_available = loc_data.get("levels", [1])
            color = loc_data.get("color", "slate")

            # REQUIREMENT 4: Doble Parada Obligatoria para Ubicación Naranja (Nivel 1 y Nivel 2)
            if color == "orange" or len(levels_available) > 1:
                # First Stop: Level 1
                stops.append({
                    "location_number": loc_data.get("number", loc_num),
                    "rack": loc_data.get("rack", f"R-{loc_num}"),
                    "aisle": loc_data.get("aisle", "Pasillo 1"),
                    "aisle_number": loc_data.get("aisle_number", 1),
                    "quadrant": loc_data.get("quadrant", "Q1"),
                    "color": "orange",
                    "color_hex": "#f97316",
                    "levels": [1, 2],
                    "chosen_level": 1,
                    "level_display": "1er Nivel (Parada 1/2)",
                    "grid_x": loc_data.get("grid_x", 0),
                    "grid_y": loc_data.get("grid_y", 0)
                })
                # Second Stop: Level 2
                stops.append({
                    "location_number": loc_data.get("number", loc_num),
                    "rack": loc_data.get("rack", f"R-{loc_num}"),
                    "aisle": loc_data.get("aisle", "Pasillo 1"),
                    "aisle_number": loc_data.get("aisle_number", 1),
                    "quadrant": loc_data.get("quadrant", "Q1"),
                    "color": "orange",
                    "color_hex": "#f97316",
                    "levels": [1, 2],
                    "chosen_level": 2,
                    "level_display": "2do Nivel (Parada 2/2 - Doble Parada)",
                    "grid_x": loc_data.get("grid_x", 0),
                    "grid_y": loc_data.get("grid_y", 0)
                })
            elif color == "red" or levels_available == [2]:
                stops.append({
                    "location_number": loc_data.get("number", loc_num),
                    "rack": loc_data.get("rack", f"R-{loc_num}"),
                    "aisle": loc_data.get("aisle", "Pasillo 1"),
                    "aisle_number": loc_data.get("aisle_number", 1),
                    "quadrant": loc_data.get("quadrant", "Q1"),
                    "color": "red",
                    "color_hex": "#ef4444",
                    "levels": [2],
                    "chosen_level": 2,
                    "level_display": "2do Nivel (Nivel Superior)",
                    "grid_x": loc_data.get("grid_x", 0),
                    "grid_y": loc_data.get("grid_y", 0)
                })
            else: # Yellow or Slate
                color_val = "yellow" if color == "yellow" else "slate"
                hex_val = "#eab308" if color == "yellow" else "#334155"
                stops.append({
                    "location_number": loc_data.get("number", loc_num),
                    "rack": loc_data.get("rack", f"R-{loc_num}"),
                    "aisle": loc_data.get("aisle", "Pasillo 1"),
                    "aisle_number": loc_data.get("aisle_number", 1),
                    "quadrant": loc_data.get("quadrant", "Q1"),
                    "color": color_val,
                    "color_hex": hex_val,
                    "levels": [1],
                    "chosen_level": 1,
                    "level_display": "1er Nivel (Nivel Base)",
                    "grid_x": loc_data.get("grid_x", 0),
                    "grid_y": loc_data.get("grid_y", 0)
                })

        if errors:
            return {
                "success": False,
                "errors": errors,
                "warnings": warnings,
                "message": "Error al procesar la lista de coordenadas/racks."
            }

        if not stops:
            return {
                "success": False,
                "message": "La lista de paradas está vacía."
            }

        original_sequence = list(stops)
        original_distance_m = self._calculate_route_distance(original_sequence, blocked_aisles_set)

        optimized_sequence = self._sort_picking_s_shape(stops, blocked_aisles_set)

        for idx, item in enumerate(optimized_sequence, start=1):
            item["pick_order"] = idx

        optimized_distance_m = self._calculate_route_distance(optimized_sequence, blocked_aisles_set)
        route_waypoints = self._build_canvas_waypoints(optimized_sequence, blocked_aisles_set)

        return {
            "success": True,
            "message": f"Ruta calculada con éxito. {len(optimized_sequence)} paradas de racks registradas.",
            "layout_id": layout_id,
            "warnings": warnings,
            "total_stops": len(optimized_sequence),
            "route_list": optimized_sequence,
            "distance_comparison": {
                "original_sequence_distance_m": round(original_distance_m, 1),
                "optimized_sequence_distance_m": round(optimized_distance_m, 1),
                "distance_saved_m": round(max(0, original_distance_m - optimized_distance_m), 1),
                "methodology_disclaimer": "Recorrido S-Shape restringido estrictamente a pasillos (sin modo vuelo) basado en plano real."
            },
            "route_waypoints": route_waypoints
        }

    def optimize_picking(
        self,
        requested_items: List[Dict[str, Any]],  # [{"sku": "SKU-1", "quantity": 5}, ...]
        layout_id: str = "EXAMPLE_HACKATHON_2026",
        blocked_aisles: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generates an ordered dispatch list with multi-level stop enforcement and aisle routing.
        """
        blocked_aisles_set = set(blocked_aisles or [])
        layout = self.example_layout if layout_id == "EXAMPLE_HACKATHON_2026" else CUSTOM_LAYOUTS_STORE.get(layout_id, self.example_layout)
        loc_map = layout["locations"]

        errors = []
        warnings = []
        picking_items = []

        # 1. VALIDATIONS & MULTI-LEVEL EXPANSION
        for req in requested_items:
            sku = str(req.get("sku", "")).strip()
            qty = int(req.get("quantity", 1))

            if sku not in self.inventory:
                errors.append(f"El SKU '{sku}' no existe en el maestro de inventario.")
                continue

            inv_item = self.inventory[sku]

            if inv_item.get("stock", 0) < qty:
                errors.append(f"Stock insuficiente para SKU '{sku}'. Solicitado: {qty}, Disponible: {inv_item.get('stock', 0)}.")
                continue

            loc_id = inv_item.get("location_id")
            if not loc_id or loc_id not in loc_map:
                loc_id = next((lid for lid, loc in loc_map.items() if sku in loc.get("assigned_skus", [])), None)

            if not loc_id or loc_id not in loc_map:
                errors.append(f"El SKU '{sku}' no tiene una ubicación asignada en el layout seleccionado.")
                continue

            loc_data = loc_map[loc_id]

            if loc_data.get("aisle") in blocked_aisles_set:
                warnings.append(f"El pasillo '{loc_data.get('aisle')}' para la ubicación {loc_id} está bloqueado.")

            levels_available = loc_data.get("levels", [1])
            color = loc_data.get("color", "slate")

            # REQUIREMENT 4: Doble parada obligatoria para ubicación Naranja
            if color == "orange" or len(levels_available) > 1:
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
                    "color": "orange",
                    "color_hex": "#f97316",
                    "levels": [1, 2],
                    "chosen_level": 1,
                    "level_display": "1er Nivel (Parada 1/2)",
                    "grid_x": loc_data.get("grid_x", 0),
                    "grid_y": loc_data.get("grid_y", 0),
                    "picked": False
                })
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
                    "color": "orange",
                    "color_hex": "#f97316",
                    "levels": [1, 2],
                    "chosen_level": 2,
                    "level_display": "2do Nivel (Parada 2/2 - Doble Parada)",
                    "grid_x": loc_data.get("grid_x", 0),
                    "grid_y": loc_data.get("grid_y", 0),
                    "picked": False
                })
            elif color == "red" or levels_available == [2]:
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
                    "color": "red",
                    "color_hex": "#ef4444",
                    "levels": [2],
                    "chosen_level": 2,
                    "level_display": "2do Nivel (Nivel Superior)",
                    "grid_x": loc_data.get("grid_x", 0),
                    "grid_y": loc_data.get("grid_y", 0),
                    "picked": False
                })
            else:
                color_val = "yellow" if color == "yellow" else "slate"
                hex_val = "#eab308" if color == "yellow" else "#334155"
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
                    "color": color_val,
                    "color_hex": hex_val,
                    "levels": [1],
                    "chosen_level": 1,
                    "level_display": "1er Nivel (Nivel Base)",
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

        # 2. OPTIMIZED S-SHAPE SEQUENCE & AISLE ROUTING
        original_sequence = list(picking_items)
        original_distance_m = self._calculate_route_distance(original_sequence, blocked_aisles_set)

        optimized_sequence = self._sort_picking_s_shape(picking_items, blocked_aisles_set)

        for idx, item in enumerate(optimized_sequence, start=1):
            item["pick_order"] = idx

        optimized_distance_m = self._calculate_route_distance(optimized_sequence, blocked_aisles_set)
        route_waypoints = self._build_canvas_waypoints(optimized_sequence, blocked_aisles_set)

        return {
            "success": True,
            "message": f"Lista de despacho generada con éxito. {len(optimized_sequence)} paradas ordenadas.",
            "layout_id": layout_id,
            "warnings": warnings,
            "total_items": len(optimized_sequence),
            "dispatch_list": optimized_sequence,
            "distance_comparison": {
                "original_sequence_distance_m": round(original_distance_m, 1),
                "optimized_sequence_distance_m": round(optimized_distance_m, 1),
                "distance_saved_m": round(max(0, original_distance_m - optimized_distance_m), 1),
                "methodology_disclaimer": "Distancias reales basadas en medidas del plano con restricción de tránsito por pasillos (sin modo vuelo)."
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
        Groups by Aisle. Alternates direction (ascending vs descending Y) per aisle.
        Preserves level ordering (Level 1 before Level 2) at the same rack position.
        """
        aisles_map: Dict[int, List[Dict[str, Any]]] = {}
        for item in items:
            a_num = item["aisle_number"]
            aisles_map.setdefault(a_num, []).append(item)

        sorted_aisles = sorted(aisles_map.keys())
        optimized_list = []

        for idx, a_num in enumerate(sorted_aisles):
            aisle_items = aisles_map[a_num]
            if idx % 2 == 0:
                aisle_items.sort(key=lambda x: (x["grid_y"], x["chosen_level"]))
            else:
                aisle_items.sort(key=lambda x: (-x["grid_y"], x["chosen_level"]))

            optimized_list.extend(aisle_items)

        return optimized_list

    def _get_leg_path_and_distance(
        self,
        curr_x: int,
        curr_y: int,
        target_x: int,
        target_y: int,
        curr_aisle: str,
        target_aisle: str,
        blocked_aisles: set
    ) -> Dict[str, Any]:
        """
        REQUIREMENT 2 & 3:
        Calculates shortest realistic path restricted to aisles & cross-aisle corridors
        (no diagonal cuts / 'modo vuelo') based on real blueprint parameters.
        """
        y_scale = BLUEPRINT_PARAMS["grid_y_unit_m"]        # 1.0 m / unit Y
        x_scale = BLUEPRINT_PARAMS["grid_x_unit_m"]        # 0.8 m / unit X (2.4m per 3 units)
        bottom_clearance = BLUEPRINT_PARAMS["bottom_corridor_depth_m"] # 5.0m
        top_clearance = BLUEPRINT_PARAMS["top_corridor_depth_m"]    # 3.0m

        curr_blocked = curr_aisle in blocked_aisles
        target_blocked = target_aisle in blocked_aisles
        aisle_penalty = 15.0 if (curr_blocked or target_blocked) else 0.0

        if curr_x == target_x:
            # Same aisle movement
            dist = (abs(target_y - curr_y) * y_scale) + aisle_penalty
            return {
                "distance_m": dist,
                "transits": []
            }

        # Cross-aisle movement: Option A (Bottom Corridor y=0) vs Option B (Top Corridor y=16)
        dist_bottom = (
            (curr_y * y_scale)
            + (abs(target_x - curr_x) * x_scale)
            + (target_y * y_scale)
            + bottom_clearance
            + aisle_penalty
        )

        dist_top = (
            ((16 - curr_y) * y_scale)
            + (abs(target_x - curr_x) * x_scale)
            + ((16 - target_y) * y_scale)
            + top_clearance
            + aisle_penalty
        )

        if dist_bottom <= dist_top:
            return {
                "distance_m": dist_bottom,
                "transits": [
                    {"x": curr_x, "y": 0, "label": f"Giro a Corredor Inferior de Conexión ({curr_aisle})"},
                    {"x": target_x, "y": 0, "label": f"Tránsito Inferior e Ingreso a {target_aisle}"}
                ]
            }
        else:
            return {
                "distance_m": dist_top,
                "transits": [
                    {"x": curr_x, "y": 16, "label": f"Giro a Corredor Superior de Conexión ({curr_aisle})"},
                    {"x": target_x, "y": 16, "label": f"Tránsito Superior e Ingreso a {target_aisle}"}
                ]
            }

    def _calculate_route_distance(
        self,
        sequence: List[Dict[str, Any]],
        blocked_aisles: set
    ) -> float:
        """
        Calculates total route distance in meters following blueprint dimensions and aisle constraints.
        """
        if not sequence:
            return 0.0

        current_x, current_y = 2, 0  # Entrance / Despacho
        current_aisle = "Pasillo 1"
        total_dist_m = 0.0

        for item in sequence:
            target_x = item["grid_x"]
            target_y = item["grid_y"]
            target_aisle = item["aisle"]

            leg_info = self._get_leg_path_and_distance(
                current_x, current_y, target_x, target_y,
                current_aisle, target_aisle, blocked_aisles
            )
            total_dist_m += leg_info["distance_m"]
            current_x, current_y, current_aisle = target_x, target_y, target_aisle

        # Return to exit point (2, 0)
        return_info = self._get_leg_path_and_distance(
            current_x, current_y, 2, 0,
            current_aisle, "Pasillo 1", blocked_aisles
        )
        total_dist_m += return_info["distance_m"]

        return total_dist_m

    def _build_canvas_waypoints(
        self,
        sequence: List[Dict[str, Any]],
        blocked_aisles: set
    ) -> List[Dict[str, Any]]:
        """
        Generates enriched waypoints including intermediate corridor transits
        so visual SVG route and AGV vehicle follow aisle corridors orthogonally (no flight mode).
        """
        waypoints = [{
            "step": 0,
            "type": "START",
            "x": 2,
            "y": 0,
            "zone": "Zona Inferior de Entrada / Despacho",
            "audio_tag": "start",
            "label": "Punto de Inicio / Despacho"
        }]

        current_x, current_y = 2, 0
        current_aisle = "Pasillo 1"
        pick_step_counter = 1

        for item in sequence:
            target_x = item["grid_x"]
            target_y = item["grid_y"]
            target_aisle = item["aisle"]

            leg_info = self._get_leg_path_and_distance(
                current_x, current_y, target_x, target_y,
                current_aisle, target_aisle, blocked_aisles
            )

            # Insert intermediate corridor transit waypoints if cross-aisle movement
            for tr in leg_info["transits"]:
                a_num = 1 if tr["x"] <= 3 else (2 if tr["x"] <= 6 else (3 if tr["x"] <= 9 else 4))
                waypoints.append({
                    "type": "TRANSIT",
                    "x": tr["x"],
                    "y": tr["y"],
                    "aisle_number": a_num,
                    "aisle": f"Pasillo {a_num}",
                    "label": tr["label"]
                })

            color = item.get("color", "slate")
            chosen_level = item.get("chosen_level", 1)
            sku_val = item.get("sku", f"RACK-{item['location_number']}")
            sku_text = f" SKU {item['sku']}" if "sku" in item else ""

            level_str = "1er Nivel" if chosen_level == 1 else "2do Nivel"
            if color == "orange":
                tag = "pick_orange_l1" if chosen_level == 1 else "pick_orange_l2"
                dwell = 1200 if chosen_level == 1 else 1500
            elif color == "red":
                tag = "pick_red"
                dwell = 1500
            elif color == "yellow":
                tag = "pick_yellow"
                dwell = 1000
            else:
                tag = "pick_slate"
                dwell = 1000

            waypoints.append({
                "step": pick_step_counter,
                "type": "PICK",
                "x": target_x,
                "y": target_y,
                "sku": sku_val,
                "location": item["location_number"],
                "aisle": target_aisle,
                "aisle_number": item.get("aisle_number", 1),
                "rack": item.get("rack", f"R{item['location_number']}"),
                "quadrant": item.get("quadrant", "Q1"),
                "color": color,
                "chosen_level": chosen_level,
                "dwell_time_ms": dwell,
                "audio_tag": tag,
                "label": f"#{pick_step_counter} Rack {item.get('rack', 'R' + str(item['location_number']))}{sku_text} ({item.get('level_display', level_str)})"
            })

            pick_step_counter += 1
            current_x, current_y, current_aisle = target_x, target_y, target_aisle

        # Return leg transits back to Entrance (2, 0)
        return_info = self._get_leg_path_and_distance(
            current_x, current_y, 2, 0,
            current_aisle, "Pasillo 1", blocked_aisles
        )
        for tr in return_info["transits"]:
            waypoints.append({
                "type": "TRANSIT",
                "x": tr["x"],
                "y": tr["y"],
                "label": tr["label"]
            })

        waypoints.append({
            "step": pick_step_counter,
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
