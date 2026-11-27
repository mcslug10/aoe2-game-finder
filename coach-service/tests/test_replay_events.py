import sys
import unittest
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import event_category, input_data, movement_analysis, extract_record, economy_series


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
            {"category": "attack_move", "timeSeconds": 10, "position": {"x": 17.0, "y": 25.0}, "selectedUnitCount": 4, "selectionGroupKey": "same"},
            {"category": "unit_order", "timeSeconds": 30, "position": {"x": 19.0, "y": 27.0}, "selectedUnitCount": 2, "selectionGroupKey": "same"},
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


    def test_selection_hash_handles_mixed_identifier_types(self):
        event = SimpleNamespace(player=SimpleNamespace(number=1), timestamp=timedelta(seconds=5), type="Order", param=None, payload={"object_ids": [2, "10", 1]}, position=SimpleNamespace(x=1, y=2))
        parsed = input_data(event, 1)
        self.assertEqual(parsed["selectedUnitCount"], 3)
        self.assertIsInstance(parsed["selectionGroupKey"], str)

    def test_non_finite_map_coordinates_are_not_serialized(self):
        event = SimpleNamespace(player=SimpleNamespace(number=1), timestamp=timedelta(seconds=1), type="Order", param=None, payload={"object_ids": []}, position=SimpleNamespace(x=float("nan"), y=float("inf")))
        self.assertIsNone(input_data(event, 1)["position"])

    def test_zip_extracts_record_and_rejects_zip_without_record(self):
        import io, zipfile
        from fastapi import HTTPException
        valid = io.BytesIO()
        with zipfile.ZipFile(valid, "w") as archive: archive.writestr("game.aoe2record", b"sample")
        self.assertEqual(extract_record(valid.getvalue(), "game.zip"), b"sample")
        invalid = io.BytesIO()
        with zipfile.ZipFile(invalid, "w") as archive: archive.writestr("notes.txt", "no replay")
        with self.assertRaises(HTTPException): extract_record(invalid.getvalue(), "notes.zip")

    def test_economy_sampling_keeps_endpoints_and_point_limit(self):
        rows = [SimpleNamespace(timestamp=timedelta(seconds=i), total_resources=i * 10, total_objects=i) for i in range(250)]
        result = economy_series(SimpleNamespace(timeseries=rows), max_points=30)
        self.assertLessEqual(len(result["points"]), 30)
        self.assertEqual(result["points"][0]["timeSeconds"], 0)
        self.assertEqual(result["points"][-1]["timeSeconds"], 249)
        self.assertEqual(result["resourceEnd"], 2490)

    def test_extract_rejects_zip_member_over_limit(self):
        import io, zipfile
        from fastapi import HTTPException
        archive_data = io.BytesIO()
        with zipfile.ZipFile(archive_data, "w") as archive:
            info = zipfile.ZipInfo("large.aoe2record"); info.file_size = 100 * 1024 * 1024 + 1
            archive.writestr(info, b"x")
        with self.assertRaises(HTTPException): extract_record(archive_data.getvalue(), "large.zip")
if __name__ == "__main__":
    unittest.main()
