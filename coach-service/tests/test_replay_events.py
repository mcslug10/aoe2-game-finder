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
        import io, zipfile, app
        from fastapi import HTTPException
        archive_data = io.BytesIO()
        with zipfile.ZipFile(archive_data, "w") as archive:
            archive.writestr("large.aoe2record", b"12345")
        original_limit = app.MAX_UPLOAD_BYTES
        app.MAX_UPLOAD_BYTES = 4
        try:
            with self.assertRaises(HTTPException):
                extract_record(archive_data.getvalue(), "large.zip")
        finally:
            app.MAX_UPLOAD_BYTES = original_limit


    def test_economy_skips_non_finite_resource_values(self):
        rows = [
            SimpleNamespace(timestamp=timedelta(seconds=0), total_resources=10, total_objects=1),
            SimpleNamespace(timestamp=timedelta(seconds=1), total_resources=float("nan"), total_objects=float("inf")),
            SimpleNamespace(timestamp=timedelta(seconds=2), total_resources=30, total_objects=3),
        ]
        result = economy_series(SimpleNamespace(timeseries=rows))
        self.assertEqual([point["totalResources"] for point in result["points"]], [10, 30])
        self.assertEqual(result["points"][1]["totalObjects"], 3)

    def test_economy_sampling_minimum_point_limit_is_safe(self):
        rows = [SimpleNamespace(timestamp=timedelta(seconds=i), total_resources=i, total_objects=i) for i in range(5)]
        result = economy_series(SimpleNamespace(timeseries=rows), max_points=0)
        self.assertGreaterEqual(len(result["points"]), 2)
        self.assertEqual(result["points"][0]["timeSeconds"], 0)
        self.assertEqual(result["points"][-1]["timeSeconds"], 4)


    def test_clock_rejects_non_finite_time(self):
        from app import clock
        self.assertIsNone(clock(float("nan")))
        self.assertIsNone(clock(float("inf")))

    def test_event_category_normalizes_spacing_and_underscores(self):
        self.assertEqual(event_category("  ATTACK_MOVE "), "attack_move")
        self.assertEqual(event_category(" gather_point "), "rally")

    def test_safe_text_collapses_whitespace_and_limits_length(self):
        from app import safe_str, EVENT_DETAIL_LIMIT
        self.assertEqual(safe_str("  cavalry\\n  queue "), "cavalry queue")
        self.assertEqual(len(safe_str("x" * 500)), EVENT_DETAIL_LIMIT)

    def test_event_without_player_is_ignored(self):
        self.assertIsNone(input_data(SimpleNamespace(player=None)))

    def test_malformed_payload_does_not_crash(self):
        event = SimpleNamespace(player=SimpleNamespace(number=1), timestamp=timedelta(seconds=2), type="Order", param=None, payload="not a mapping", position=None)
        parsed = input_data(event, 1)
        self.assertIsNone(parsed["selectionGroupKey"])
        self.assertIsNone(parsed["selectedUnitCount"])

    def test_empty_selection_has_no_group_hash(self):
        event = SimpleNamespace(player=SimpleNamespace(number=1), timestamp=timedelta(seconds=2), type="Order", param=None, payload={"object_ids":[]}, position=None)
        self.assertIsNone(input_data(event, 1)["selectionGroupKey"])

    def test_negative_resource_sample_is_ignored(self):
        rows = [SimpleNamespace(timestamp=timedelta(seconds=0), total_resources=-1, total_objects=1), SimpleNamespace(timestamp=timedelta(seconds=1), total_resources=5, total_objects=2)]
        self.assertEqual(economy_series(SimpleNamespace(timeseries=rows))["points"][0]["totalResources"], 5)

    def test_non_finite_economy_timestamp_is_ignored(self):
        rows = [SimpleNamespace(timestamp=float("nan"), total_resources=4, total_objects=1), SimpleNamespace(timestamp=timedelta(seconds=2), total_resources=8, total_objects=2)]
        self.assertEqual(len(economy_series(SimpleNamespace(timeseries=rows))["points"]), 1)

    def test_negative_economy_timestamp_is_ignored(self):
        rows = [SimpleNamespace(timestamp=timedelta(seconds=-1), total_resources=4, total_objects=1), SimpleNamespace(timestamp=timedelta(seconds=2), total_resources=8, total_objects=2)]
        self.assertEqual(economy_series(SimpleNamespace(timeseries=rows))["points"][0]["timeSeconds"], 2)

    def test_economy_ignores_infinite_objects(self):
        rows = [SimpleNamespace(timestamp=timedelta(seconds=0), total_resources=4, total_objects=float("inf"))]
        self.assertIsNone(economy_series(SimpleNamespace(timeseries=rows))["points"][0]["totalObjects"])

    def test_order_distances_ignore_large_time_gaps(self):
        events = [{"category":"unit_order","timeSeconds":0,"position":{"x":0,"y":0},"selectionGroupKey":"g"},{"category":"unit_order","timeSeconds":121,"position":{"x":100,"y":100},"selectionGroupKey":"g"}]
        self.assertEqual(movement_analysis(events)["sameSelectionTargetChanges"], 0)

    def test_order_distances_ignore_missing_timestamps(self):
        events = [{"category":"unit_order","timeSeconds":None,"position":{"x":0,"y":0},"selectionGroupKey":"g"},{"category":"unit_order","timeSeconds":5,"position":{"x":2,"y":2},"selectionGroupKey":"g"}]
        self.assertEqual(movement_analysis(events)["sameSelectionTargetChanges"], 0)

    def test_movement_ignores_non_order_categories(self):
        events = [{"category":"building","timeSeconds":1,"position":{"x":0,"y":0}}]
        self.assertEqual(movement_analysis(events)["orderCount"], 0)

    def test_event_coordinate_zero_is_preserved(self):
        event = SimpleNamespace(player=SimpleNamespace(number=1),timestamp=timedelta(seconds=1),type="Order",param=None,payload={},position=SimpleNamespace(x=0,y=0))
        self.assertEqual(input_data(event,1)["position"],{"x":0.0,"y":0.0})

    def test_limits_are_explicit_positive_constants(self):
        from app import PLAYER_TIMELINE_LIMIT, OPPONENT_TIMELINE_LIMIT, EVENT_DETAIL_LIMIT
        self.assertEqual((PLAYER_TIMELINE_LIMIT, OPPONENT_TIMELINE_LIMIT, EVENT_DETAIL_LIMIT),(250,150,240))

    def test_non_numeric_profile_id_returns_none(self):
        from app import player_profile_id
        self.assertIsNone(player_profile_id(SimpleNamespace(profile_id="invalid")))

if __name__ == "__main__":
    unittest.main()
