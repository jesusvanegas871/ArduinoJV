import random
import math
from typing import List, Dict, Any, Optional

class CycleCountEngine:
    """
    Core engine for Warehouse Management System (WMS) Cycle Counting.
    Enforces business logic:
    - 52-week annual schedule.
    - Exactly 5 counts per reference per year (min 5, max 5).
    - Automatic blocking/exclusion of references once they reach 5 counts.
    - Dynamic random weekly allocation ensuring balanced distribution.
    """

    def __init__(self, references: List[Dict[str, Any]]):
        self.total_weeks = 52
        self.target_counts = 5
        self.current_week = 0
        self.references: Dict[str, Dict[str, Any]] = {}
        self.weekly_schedule: Dict[int, List[str]] = {w: [] for w in range(1, self.total_weeks + 1)}
        self.load_references(references)

    def load_references(self, references: List[Dict[str, Any]]):
        """Loads or resets references with cycle counting tracking state."""
        self.current_week = 0
        self.weekly_schedule = {w: [] for w in range(1, self.total_weeks + 1)}
        self.references = {}

        for ref in references:
            sku = str(ref["sku"]).strip()
            self.references[sku] = {
                "sku": sku,
                "description": ref.get("description", "N/A"),
                "category": ref.get("category", "B"),
                "location": ref.get("location", "N/A"),
                "stock": ref.get("stock", 0),
                "unit_cost": ref.get("unit_cost", 0.0),
                "counts_completed": 0,
                "target_counts": self.target_counts,
                "weeks_counted": [],
                "is_blocked": False,  # True when counts_completed == 5
                "status": "PENDING"  # PENDING, IN_PROGRESS, COMPLETED
            }

    def reset(self):
        """Resets counting history while maintaining loaded reference list."""
        self.current_week = 0
        self.weekly_schedule = {w: [] for w in range(1, self.total_weeks + 1)}
        for item in self.references.values():
            item["counts_completed"] = 0
            item["weeks_counted"] = []
            item["is_blocked"] = False
            item["status"] = "PENDING"

    def get_reference_list(self) -> List[Dict[str, Any]]:
        """Returns current list of references with cycle count progress."""
        items = []
        for sku, item in self.references.items():
            item_copy = item.copy()
            item_copy["counts_remaining"] = self.target_counts - item_copy["counts_completed"]
            items.append(item_copy)
        return items

    def get_summary_stats(self) -> Dict[str, Any]:
        """Calculates global inventory and count metrics."""
        total_items = len(self.references)
        completed_items = sum(1 for item in self.references.values() if item["counts_completed"] == 5)
        blocked_items = sum(1 for item in self.references.values() if item["is_blocked"])
        in_progress_items = sum(1 for item in self.references.values() if 0 < item["counts_completed"] < 5)
        pending_items = sum(1 for item in self.references.values() if item["counts_completed"] == 0)

        total_scheduled_counts = sum(item["counts_completed"] for item in self.references.values())
        max_total_counts = total_items * self.target_counts
        completion_percentage = round((total_scheduled_counts / max_total_counts * 100), 1) if max_total_counts > 0 else 0.0

        return {
            "total_items": total_items,
            "completed_items": completed_items,
            "blocked_items": blocked_items,
            "in_progress_items": in_progress_items,
            "pending_items": pending_items,
            "total_scheduled_counts": total_scheduled_counts,
            "max_total_counts": max_total_counts,
            "completion_percentage": completion_percentage,
            "current_week": self.current_week,
            "total_weeks": self.total_weeks
        }

    def generate_next_week(self, seed: Optional[int] = None) -> Dict[str, Any]:
        """
        Generates cycle count for the next week randomly, respecting strict 5 count rules.
        """
        if seed is not None:
            random.seed(seed)

        if self.current_week >= self.total_weeks:
            return {
                "success": False,
                "message": "Se ha alcanzado el límite anual de 52 semanas.",
                "week": self.current_week,
                "selected_skus": []
            }

        target_week = self.current_week + 1
        weeks_remaining = self.total_weeks - target_week + 1

        # Identify items
        mandatory_skus = []
        eligible_skus = []

        for sku, item in self.references.items():
            completed = item["counts_completed"]
            needed = self.target_counts - completed

            # STRICT RULE: Exclude blocked items (already reached 5 counts)
            if completed >= self.target_counts:
                item["is_blocked"] = True
                item["status"] = "COMPLETED"
                continue

            # Check if mandatory to guarantee 5 counts by week 52
            if needed == weeks_remaining:
                mandatory_skus.append(sku)
            elif needed > 0:
                eligible_skus.append(sku)

        # Calculate dynamic weekly quota
        total_remaining_needed = sum(self.target_counts - item["counts_completed"] for item in self.references.values() if item["counts_completed"] < self.target_counts)
        avg_per_week = total_remaining_needed / weeks_remaining if weeks_remaining > 0 else 0

        # Quota target with subtle random variation for realistic scheduling
        base_quota = math.ceil(avg_per_week)
        min_quota = max(len(mandatory_skus), math.floor(avg_per_week))
        max_quota = max(len(mandatory_skus), base_quota + 1)

        desired_count = random.randint(min_quota, max_quota) if min_quota <= max_quota else len(mandatory_skus)

        # Select mandatory first, then fill randomly from eligible
        selected = set(mandatory_skus)
        slots_needed = max(0, desired_count - len(selected))

        if slots_needed > 0 and eligible_skus:
            additional = random.sample(eligible_skus, min(slots_needed, len(eligible_skus)))
            selected.update(additional)

        selected_list = sorted(list(selected))

        # Update state for selected items
        for sku in selected_list:
            item = self.references[sku]
            item["counts_completed"] += 1
            item["weeks_counted"].append(target_week)

            if item["counts_completed"] >= self.target_counts:
                item["is_blocked"] = True
                item["status"] = "COMPLETED"
            else:
                item["status"] = "IN_PROGRESS"

        self.current_week = target_week
        self.weekly_schedule[target_week] = selected_list

        selected_items_details = [self.references[sku].copy() for sku in selected_list]

        return {
            "success": True,
            "message": f"Semana {target_week} generada aleatoriamente con éxito.",
            "week": target_week,
            "selected_count": len(selected_list),
            "mandatory_count": len(mandatory_skus),
            "selected_skus": selected_list,
            "selected_items": selected_items_details,
            "stats": self.get_summary_stats()
        }

    def simulate_full_year(self, seed: Optional[int] = None) -> Dict[str, Any]:
        """Simulates all 52 weeks in sequence."""
        if seed is not None:
            random.seed(seed)

        self.reset()
        for w in range(1, self.total_weeks + 1):
            self.generate_next_week()

        return {
            "success": True,
            "message": "Simulación de 52 semanas completada exitosamente.",
            "stats": self.get_summary_stats(),
            "schedule": self.get_full_schedule()
        }

    def get_full_schedule(self) -> Dict[str, Any]:
        """Returns details for all 52 weeks."""
        schedule_details = {}
        for week, skus in self.weekly_schedule.items():
            schedule_details[week] = {
                "week": week,
                "count": len(skus),
                "items": [self.references[sku].copy() for sku in skus if sku in self.references]
            }
        return schedule_details
