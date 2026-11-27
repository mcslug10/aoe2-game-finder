import sys
import unittest
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import event_category, input_data, movement_analysis


class ReplayEventTests(unittest.TestCase):
    def test_action_categories_are_conservative(self):
        self.assertEqual(event_category("Attack Move"), "attack_move")
        self.assertEqual(event_category("Order"), "unit_order")
        self.assertEqual(event_category("Build"), "building")
        self.assertEqual(event_category("Research"), "research")
        self.assertEqual(event_category("Chat"), "other")

    def test_event_keeps_timestamp_coordinates_and_selected_count(self):
        event = SimpleNamespace(
            player=SimpleNamespace(number=1),
            timestamp=timedelta(seconds=127),
            type="Attack Move",
            param="",
            payload={"object_ids": [11, 12, 13]},
            position=SimpleNamespace(x=42.25, y=18.5),
        )
        parsed = input_data(event, 1)
        self.assertEqual(parsed["time"], "02:07")
        self.assertEqual(parsed["category"], "attack_move")
        self.assertEqual(parsed["position"], {"x": 42.25, "y": 18.5})
        self.assertEqual(parsed["selectedUnitCount"], 3)

    def test_movement_summary_counts_coordinates_and_attack_move(self):
        events = [
            {"category": "attack_move", "position": {"x": 17.0, "y": 25.0}, "selectedUnitCount": 4, "selectionGroupKey": "same"},
            {"category": "unit_order", "position": {"x": 19.0, "y": 27.0}, "selectedUnitCount": 2, "selectionGroupKey": "same"},
            {"category": "unit_order", "position": None, "selectedUnitCount": 1},
        ]
        result = movement_analysis(events)
        self.assertEqual(result["orderCount"], 3)
        self.assertEqual(result["attackMoveCount"], 1)
        self.assertEqual(result["ordersWithCoordinates"], 2)
        self.assertEqual(result["averageSelectedUnits"], 2.3)
        self.assertEqual(result["topCommandAreas"][0]["commands"], 2)
        self.assertEqual(result["sameSelectionTargetChanges"], 1)
        self.assertEqual(result["averageTargetDistance"], 2.8)

    def test_unfiltered_event_includes_player_identity_for_opponent_context(self):
        event = SimpleNamespace(
            player=SimpleNamespace(number=2, name="EnemyPlayer"),
            timestamp=timedelta(seconds=45),
            type="Queue",
            param="Knight",
            payload={"object_ids": []},
            position=None,
        )
        parsed = input_data(event)
        self.assertEqual(parsed["playerNumber"], 2)
        self.assertEqual(parsed["playerName"], "EnemyPlayer")
        self.assertEqual(parsed["detail"], "Knight")

    def test_events_from_other_players_are_excluded(self):
        event = SimpleNamespace(player=SimpleNamespace(number=2))
        self.assertIsNone(input_data(event, 1))


if __name__ == "__main__":
    unittest.main()
