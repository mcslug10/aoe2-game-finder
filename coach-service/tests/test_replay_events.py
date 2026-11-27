import sys
import unittest
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import event_category, input_data


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

    def test_events_from_other_players_are_excluded(self):
        event = SimpleNamespace(player=SimpleNamespace(number=2))
        self.assertIsNone(input_data(event, 1))


if __name__ == "__main__":
    unittest.main()
