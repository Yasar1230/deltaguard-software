import json
import unittest
from pathlib import Path

import controller_v1
import controller_v2
from run_sim import simulate
from diff_engine import build_diffs


ROOT = Path(__file__).parent
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8-sig"))
SCENARIOS = {s["name"]: s for s in json.loads((ROOT / "scenarios.json").read_text(encoding="utf-8-sig"))}


class ControllerTests(unittest.TestCase):
    def test_v1_window_cutoffs(self):
        state = {"temperature_c": 47, "voltage_v": 3.5}
        self.assertTrue(controller_v1.step(state, CONFIG, [])['cutoff'])
        state["temperature_c"] = -1
        self.assertTrue(controller_v1.step(state, CONFIG, [])['cutoff'])

    def test_cold_derating(self):
        result = controller_v1.step({"temperature_c": 5, "voltage_v": 3.5}, CONFIG, [])
        self.assertEqual(result["mode"], "COLD_DERATED")
        self.assertAlmostEqual(result["requested_current_a"], 0.8125)

    def test_cv_and_completion(self):
        run = simulate(SCENARIOS["near_full_soc_start_90pc"], CONFIG, controller_v1)
        self.assertIn("CV", [r["mode"] for r in run["trace"]])
        self.assertEqual(run["summary"]["ended_by"], "charge complete")
        self.assertLessEqual(CONFIG["cutoff_current_ma"], run["trace"][-2]["current_a"] * 1000 + 1e-6)

    def test_sensor_fault(self):
        result = controller_v1.step({"temperature_c": 25, "voltage_v": 3.5}, CONFIG, ["temp_sensor_fail"])
        self.assertTrue(result["cutoff"])
        self.assertIn("temp_sensor_fail", result["reason"])

    def test_only_regression_scenarios_differ(self):
        results = {name: {"v1": simulate(s, CONFIG, controller_v1), "v2": simulate(s, CONFIG, controller_v2)} for name, s in SCENARIOS.items()}
        changed = {name for name, pair in results.items() if pair["v1"]["summary"] != pair["v2"]["summary"]}
        self.assertEqual(changed, {"cold_5c", "sensor_fault_at_25c", "sensor_fault_at_5c", "warm_47c", "ramp_30_to_48c"})
        self.assertGreaterEqual(len(SCENARIOS.keys() - changed), 3)

    def test_all_three_regressions_are_observed(self):
        self.assertTrue(simulate(SCENARIOS["warm_47c"], CONFIG, controller_v2)["summary"]["charged_outside_window"])
        self.assertGreater(simulate(SCENARIOS["cold_5c"], CONFIG, controller_v2)["summary"]["peak_current_a"],
                           simulate(SCENARIOS["cold_5c"], CONFIG, controller_v1)["summary"]["peak_current_a"])
        self.assertGreater(simulate(SCENARIOS["sensor_fault_at_25c"], CONFIG, controller_v2)["summary"]["final_soc"],
                           simulate(SCENARIOS["sensor_fault_at_25c"], CONFIG, controller_v1)["summary"]["final_soc"])


if __name__ == "__main__":
    unittest.main()
