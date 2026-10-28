import heapq
from typing import Dict, List, Any, Optional

# Satellite Destinations Definition with Coordinates and Metadata
SATELLITES: Dict[str, Dict[str, Any]] = {
    "ACACIAS": {
        "id": "ACACIAS",
        "name": "Acacías (Meta)",
        "coordinates": {"lat": 3.9869, "lng": -73.7578},
        "description": "Satélite regional sur - Zona agroindustrial y comercial",
        "demand_tons": 8.5
    },
    "GRANADA": {
        "id": "GRANADA",
        "name": "Granada (Meta)",
        "coordinates": {"lat": 3.5463, "lng": -73.7067},
        "description": "Satélite Ariari - Centro de acopio agrícola masivo",
        "demand_tons": 12.0
    },
    "PUERTO_LOPEZ": {
        "id": "PUERTO_LOPEZ",
        "name": "Puerto López (Meta)",
        "coordinates": {"lat": 4.0847, "lng": -72.9556},
        "description": "Satélite Altillanura - Ombligo de Colombia",
        "demand_tons": 6.2
    },
    "RESTREPO": {
        "id": "RESTREPO",
        "name": "Restrepo (Meta)",
        "coordinates": {"lat": 4.2608, "lng": -73.5622},
        "description": "Satélite norte cercano - Distribución rápida",
        "demand_tons": 4.0
    },
    "SAN_JOSE_GUAVIARE": {
        "id": "SAN_JOSE_GUAVIARE",
        "name": "San José del Guaviare",
        "coordinates": {"lat": 2.5728, "lng": -72.6459},
        "description": "Satélite sur lejano - Corredor amazónico",
        "demand_tons": 15.0
    },
    "YOPAL": {
        "id": "YOPAL",
        "name": "Yopal (Casanare)",
        "coordinates": {"lat": 5.3378, "lng": -72.3959},
        "description": "Satélite Orinoquía Norte - Sector hidrocarburos y ganado",
        "demand_tons": 18.0
    },
    "BOGOTA": {
        "id": "BOGOTA",
        "name": "Bogotá D.C. (Cundinamarca)",
        "coordinates": {"lat": 4.7110, "lng": -74.0721},
        "description": "Hub Central de Redistribución Nacional",
        "demand_tons": 25.0
    }
}

# VEHICLE PROFILES
VEHICLE_PROFILES = {
    "CAMIONET": {
        "id": "CAMIONET",
        "name": "Camioneta Turbo (3.5 Ton)",
        "max_capacity_kg": 3500,
        "max_volume_m3": 18,
        "cost_per_km": 3200,  # COP
        "fixed_cost": 80000,
        "max_weight_restriction_kg": 3500
    },
    "CAMION_C2": {
        "id": "CAMION_C2",
        "name": "Camión Rigido C2 (10 Ton)",
        "max_capacity_kg": 10000,
        "max_volume_m3": 45,
        "cost_per_km": 5500,
        "fixed_cost": 150000,
        "max_weight_restriction_kg": 10000
    },
    "TRACTOMULA_C3S3": {
        "id": "TRACTOMULA_C3S3",
        "name": "Tractocamión C3S3 (32 Ton)",
        "max_capacity_kg": 32000,
        "max_volume_m3": 90,
        "cost_per_km": 9200,
        "fixed_cost": 300000,
        "max_weight_restriction_kg": 32000
    }
}

# NETWORK GRAPH DATA
# Real Data vs Demo Data Road Graph
REAL_ROAD_GRAPH = {
    # Node Villavicencio
    "VILLAVICENCIO": [
        {
            "target": "RESTREPO",
            "via_name": "Ruta 65 Norte (Via Restrepo)",
            "distance_km": 18,
            "time_hours": 0.35,
            "tolls_count": 1,
            "tolls_cost_cop": 14200,
            "road_status": "Óptima",
            "weight_limit_ton": 32,
            "restrictions": "Ninguna"
        },
        {
            "target": "ACACIAS",
            "via_name": "Ruta 65 Sur (Via Acacías)",
            "distance_km": 28,
            "time_hours": 0.5,
            "tolls_count": 1,
            "tolls_cost_cop": 14200,
            "road_status": "Buen estado",
            "weight_limit_ton": 32,
            "restrictions": "Tráfico urbano en horas pico"
        },
        {
            "target": "PUERTO_LOPEZ",
            "via_name": "Ruta 40 Oriente (Via Puerto López)",
            "distance_km": 86,
            "time_hours": 1.4,
            "tolls_count": 1,
            "tolls_cost_cop": 14200,
            "road_status": "Pavimentada",
            "weight_limit_ton": 32,
            "restrictions": "Control de velocidad en intersecciones"
        },
        {
            "target": "BOGOTA",
            "via_name": "Vía al Llano (Ruta 40 Principal por Túneles)",
            "distance_km": 118,
            "time_hours": 3.0,
            "tolls_count": 3,
            "tolls_cost_cop": 52800,
            "road_status": "Operativa con monitoreo de ladera",
            "weight_limit_ton": 32,
            "restrictions": "Paso restringido en túnel Pipiral por mantenimiento nocturno"
        },
        {
            "target": "BOGOTA_ALT",
            "via_name": "Ruta Alterna Transversal del Sisga (Guateque)",
            "distance_km": 320,
            "time_hours": 7.5,
            "tolls_count": 4,
            "tolls_cost_cop": 48000,
            "road_status": "Vía secundaria con curvas pronunciadas",
            "weight_limit_ton": 15,
            "restrictions": "Restricción de carga pesada > 15 Ton en puentes"
        }
    ],
    "RESTREPO": [
        {
            "target": "YOPAL",
            "via_name": "Marginal de la Selva (Ruta 65 Norte)",
            "distance_km": 235,
            "time_hours": 4.2,
            "tolls_count": 2,
            "tolls_cost_cop": 28400,
            "road_status": "Buen estado",
            "weight_limit_ton": 32,
            "restrictions": "Obras menores en paso por Villanueva"
        }
    ],
    "ACACIAS": [
        {
            "target": "GRANADA",
            "via_name": "Corredor del Ariari (Ruta 65 Sur)",
            "distance_km": 52,
            "time_hours": 0.9,
            "tolls_count": 1,
            "tolls_cost_cop": 14200,
            "road_status": "Pavimentada",
            "weight_limit_ton": 32,
            "restrictions": "Paso de maquinaria agrícola"
        }
    ],
    "GRANADA": [
        {
            "target": "SAN_JOSE_GUAVIARE",
            "via_name": "Troncal de la Selva (Ruta 65 Sur extrema)",
            "distance_km": 208,
            "time_hours": 3.8,
            "tolls_count": 0,
            "tolls_cost_cop": 0,
            "road_status": "Afirmado y asfalto intercalado",
            "weight_limit_ton": 22,
            "restrictions": "Sin señal celular en 60km, recomendar viaje diurno"
        }
    ]
}

# Demo Data Graph: Simulates alternate contingency conditions, seasonal roadworks & dynamic pricing
DEMO_ROAD_GRAPH = {
    "VILLAVICENCIO": [
        {
            "target": "RESTREPO",
            "via_name": "Ruta 65 Norte [DEMO SIMULACIÓN]",
            "distance_km": 22,
            "time_hours": 0.6,
            "tolls_count": 1,
            "tolls_cost_cop": 15000,
            "road_status": "Demora por plan de bacheo (+15 min)",
            "weight_limit_ton": 32,
            "restrictions": "Paso uno a uno en km 12"
        },
        {
            "target": "ACACIAS",
            "via_name": "Ruta 65 Sur [DEMO SIMULACIÓN]",
            "distance_km": 30,
            "time_hours": 0.7,
            "tolls_count": 1,
            "tolls_cost_cop": 15000,
            "road_status": "Tráfico fluido moderado",
            "weight_limit_ton": 32,
            "restrictions": "Control de pesaje activo"
        },
        {
            "target": "PUERTO_LOPEZ",
            "via_name": "Corredor Agroindustrial [DEMO SIMULACIÓN]",
            "distance_km": 90,
            "time_hours": 1.6,
            "tolls_count": 1,
            "tolls_cost_cop": 15000,
            "road_status": "Óptima para tractomulas",
            "weight_limit_ton": 52,
            "restrictions": "Ninguna"
        },
        {
            "target": "BOGOTA",
            "via_name": "Vía al Llano [DEMO CIERRE PARCIAL KM 58]",
            "distance_km": 125,
            "time_hours": 4.5,
            "tolls_count": 3,
            "tolls_cost_cop": 55000,
            "road_status": "Congestión por reversible",
            "weight_limit_ton": 32,
            "restrictions": "Cierre preventivo lluvias 22:00-05:00"
        },
        {
            "target": "BOGOTA_ALT",
            "via_name": "Ruta Alterna Guateque [DEMO ALTA DEMANDA]",
            "distance_km": 315,
            "time_hours": 6.8,
            "tolls_count": 4,
            "tolls_cost_cop": 50000,
            "road_status": "Habilitada sin restricciones de lluvia",
            "weight_limit_ton": 20,
            "restrictions": "Puente militar provisional max 20 Ton"
        }
    ],
    "RESTREPO": [
        {
            "target": "YOPAL",
            "via_name": "Marginal de la Selva [DEMO TEMPORADA SECA]",
            "distance_km": 240,
            "time_hours": 4.0,
            "tolls_count": 2,
            "tolls_cost_cop": 30000,
            "road_status": "Excelente velocidad promedio",
            "weight_limit_ton": 32,
            "restrictions": "Ninguna"
        }
    ],
    "ACACIAS": [
        {
            "target": "GRANADA",
            "via_name": "Corredor del Ariari [DEMO SIMULACIÓN]",
            "distance_km": 55,
            "time_hours": 1.0,
            "tolls_count": 1,
            "tolls_cost_cop": 15000,
            "road_status": "Buen estado",
            "weight_limit_ton": 32,
            "restrictions": "Ninguna"
        }
    ],
    "GRANADA": [
        {
            "target": "SAN_JOSE_GUAVIARE",
            "via_name": "Troncal de la Selva [DEMO MEJORADA]",
            "distance_km": 200,
            "time_hours": 3.2,
            "tolls_count": 0,
            "tolls_cost_cop": 0,
            "road_status": "Pavimentación reciente 80%",
            "weight_limit_ton": 32,
            "restrictions": "Ninguna"
        }
    ]
}


class DistributionRoutingEngine:
    """
    Engine for calculating distribution routes from Villavicencio Central Warehouse
    to company satellite locations using Multi-Criteria Shortest Path & Dijkstra algorithms.
    """

    def __init__(self, is_demo_data: bool = False):
        self.is_demo_data = is_demo_data
        self.graph = DEMO_ROAD_GRAPH if is_demo_data else REAL_ROAD_GRAPH

    def get_satellites_list(self) -> List[Dict[str, Any]]:
        return list(SATELLITES.values())

    def get_vehicle_profiles(self) -> List[Dict[str, Any]]:
        return list(VEHICLE_PROFILES.values())

    def calculate_routes(
        self,
        destination_id: str,
        cargo_weight_kg: float = 5000,
        vehicle_type: str = "CAMION_C2",
        priority: str = "BALANCED"  # FASTEST, CHEAPEST, MIN_RESTRICTIONS, BALANCED
    ) -> Dict[str, Any]:
        """
        Calculates and compares multi-objective distribution route alternatives
        from Villavicencio to the specified satellite destination.
        """
        dest_clean = destination_id.upper().strip()
        if dest_clean not in SATELLITES:
            return {
                "success": False,
                "message": f"Destino satélite '{destination_id}' no reconocido."
            }

        dest_info = SATELLITES[dest_clean]
        vehicle_info = VEHICLE_PROFILES.get(vehicle_type, VEHICLE_PROFILES["CAMION_C2"])

        # Check vehicle weight capacity
        capacity_exceeded = cargo_weight_kg > vehicle_info["max_capacity_kg"]

        # Run Dijkstra / Path Exploration for target destination
        all_routes = self._find_all_paths("VILLAVICENCIO", dest_clean, vehicle_info, cargo_weight_kg)

        if not all_routes:
            return {
                "success": False,
                "message": f"No se encontraron rutas terrestres viables hacia {dest_info['name']} con los parámetros dados.",
                "destination": dest_info,
                "vehicle": vehicle_info
            }

        # Build comparison table and justifications for alternatives
        alternatives = []

        # Sort routes according to primary criteria
        # 1. Option: Direct / Fastest Route
        fastest_route = min(all_routes, key=lambda r: r["total_time_hours"])

        # 2. Option: Cheapest Route (Fuel + Fixed + Tolls)
        cheapest_route = min(all_routes, key=lambda r: r["total_cost_cop"])

        # 3. Option: Safest / Min Restrictions Route
        safest_route = min(all_routes, key=lambda r: (r["restrictions_score"], r["total_time_hours"]))

        route_types = [
            ("Ruta Principal Recomendada (Optimizada)", "BALANCED", fastest_route),
            ("Ruta de Menor Costo Económico", "CHEAPEST", cheapest_route),
            ("Ruta de Menores Restricciones / Contingencia", "SAFEST", safest_route)
        ]

        seen_keys = set()
        for label, strategy, route in route_types:
            route_key = f"{route['total_distance_km']}-{route['total_cost_cop']}"
            if route_key in seen_keys:
                continue
            seen_keys.add(route_key)

            # Generate justification
            justification = self._generate_justification(
                strategy=strategy,
                route=route,
                vehicle=vehicle_info,
                cargo_weight_kg=cargo_weight_kg,
                capacity_exceeded=capacity_exceeded
            )

            alternatives.append({
                "label": label,
                "strategy": strategy,
                "total_distance_km": round(route["total_distance_km"], 1),
                "total_time_hours": round(route["total_time_hours"], 2),
                "formatted_time": f"{int(route['total_time_hours'])}h {int((route['total_time_hours'] % 1) * 60)}m",
                "transport_cost_cop": round(route["transport_cost_cop"], 0),
                "tolls_cost_cop": round(route["tolls_cost_cop"], 0),
                "tolls_count": route["tolls_count"],
                "total_cost_cop": round(route["total_cost_cop"], 0),
                "road_status": route["overall_road_status"],
                "restrictions": route["restrictions_list"],
                "capacity_ok": not capacity_exceeded,
                "weight_restriction_ok": route["weight_limit_ok"],
                "justification": justification,
                "legs": route["legs"]
            })

        return {
            "success": True,
            "data_type": "DEMOSTRACIÓN" if self.is_demo_data else "DATOS REALES (Red Vial Colombia 2026)",
            "is_demo_data": self.is_demo_data,
            "origin": {
                "id": "VILLAVICENCIO",
                "name": "Almacén Central Villavicencio (Meta)",
                "coordinates": {"lat": 4.1420, "lng": -73.6266}
            },
            "destination": dest_info,
            "cargo": {
                "weight_kg": cargo_weight_kg,
                "weight_tons": round(cargo_weight_kg / 1000.0, 2),
            },
            "vehicle": vehicle_info,
            "capacity_warning": "ADVERTENCIA: La carga supera la capacidad nominal del vehículo seleccionado." if capacity_exceeded else None,
            "alternatives": alternatives
        }

    def _find_all_paths(
        self,
        origin: str,
        target: str,
        vehicle: Dict[str, Any],
        cargo_weight_kg: float
    ) -> List[Dict[str, Any]]:
        """DFS / Dijkstra path explorer to gather viable paths in the graph."""
        paths = []

        def dfs(current: str, current_path: List[Dict[str, Any]], visited: set):
            if current == target or (target == "BOGOTA" and current == "BOGOTA_ALT"):
                paths.append(self._compile_route_metrics(current_path, vehicle, cargo_weight_kg))
                return

            if current not in self.graph:
                return

            for edge in self.graph[current]:
                next_node = edge["target"]
                if next_node not in visited:
                    visited.add(next_node)
                    dfs(next_node, current_path + [edge], visited)
                    visited.remove(next_node)

        dfs(origin, [], {origin})
        return paths

    def _compile_route_metrics(
        self,
        legs: List[Dict[str, Any]],
        vehicle: Dict[str, Any],
        cargo_weight_kg: float
    ) -> Dict[str, Any]:
        total_dist = sum(leg["distance_km"] for leg in legs)
        total_time = sum(leg["time_hours"] for leg in legs)
        tolls_count = sum(leg["tolls_count"] for leg in legs)
        tolls_cost = sum(leg["tolls_cost_cop"] for leg in legs)

        # Vehicle costs
        transport_cost = vehicle["fixed_cost"] + (total_dist * vehicle["cost_per_km"])
        total_cost = transport_cost + tolls_cost

        # Weight limit restriction check
        cargo_tons = cargo_weight_kg / 1000.0
        weight_limit_ok = all(cargo_tons <= leg.get("weight_limit_ton", 999) for leg in legs)

        restrictions_list = [leg["restrictions"] for leg in legs if leg["restrictions"] and leg["restrictions"] != "Ninguna"]
        restrictions_score = len(restrictions_list) + (0 if weight_limit_ok else 5)

        statuses = [leg["road_status"] for leg in legs]
        overall_status = " / ".join(statuses) if statuses else "Normal"

        return {
            "total_distance_km": total_dist,
            "total_time_hours": total_time,
            "tolls_count": tolls_count,
            "tolls_cost_cop": tolls_cost,
            "transport_cost_cop": transport_cost,
            "total_cost_cop": total_cost,
            "weight_limit_ok": weight_limit_ok,
            "restrictions_list": restrictions_list if restrictions_list else ["Sin restricciones reportadas"],
            "restrictions_score": restrictions_score,
            "overall_road_status": overall_status,
            "legs": legs
        }

    def _generate_justification(
        self,
        strategy: str,
        route: Dict[str, Any],
        vehicle: Dict[str, Any],
        cargo_weight_kg: float,
        capacity_exceeded: bool
    ) -> str:
        dist = round(route["total_distance_km"], 1)
        hours = round(route["total_time_hours"], 1)
        cost = f"${route['total_cost_cop']:,.0f} COP"
        tolls = f"${route['tolls_cost_cop']:,.0f} COP ({route['tolls_count']} peajes)"

        if capacity_exceeded:
            return (
                f"Esta alternativa requiere {dist} km y {hours} hrs con un costo estimado de {cost}. "
                f"Sin embargo, la carga de {cargo_weight_kg/1000:.1f} Ton excede la capacidad recomendada de "
                f"{vehicle['name']}. Se sugiere dividir la carga o utilizar una unidad de mayor tonelaje."
            )

        if not route["weight_limit_ok"]:
            return (
                f"Ruta alternativa con {dist} km y {hours} hrs ({cost}). "
                f"ATENCIÓN: Presenta restricciones de peso en infraestructura vial para la carga parametrizada. "
                f"Utilizar únicamente como opción secundaria con permisos especiales."
            )

        if strategy == "BALANCED":
            return (
                f"Seleccionada por ofrecer el mejor balance operacional: tiempo estimado de {hours} horas para "
                f"{dist} km. Incluye {tolls} y costo total logístico de {cost}. "
                f"Garantiza el cumplimiento de capacidad para {vehicle['name']}."
            )
        elif strategy == "CHEAPEST":
            return (
                f"Opción económica optimizada para minimizar el costo total de flete ({cost}). "
                f"Recorre {dist} km con un gasto en peajes de {tolls}. "
                f"Recomendada para despachos no urgentes o consolidados."
            )
        else:
            return (
                f"Ruta de contingencia o baja densidad de restricciones viales. "
                f"Tiempo estimado: {hours} hrs, distancia: {dist} km. "
                f"Ideal en casos de cierres o mantenimiento en la arteria principal."
            )
