import json
from pathlib import Path


FIELDS = ("final_soc", "peak_current_a", "max_temp_while_charging_c", "charge_time_s", "ended_by", "charged_outside_window")


def build_diffs(simulations: dict, config: dict) -> list[dict]:
    result = []
    for name, versions in simulations.items():
        summary1, summary2 = versions["v1"]["summary"], versions["v2"]["summary"]
        changes = []
        for field in FIELDS:
            old, new = summary1[field], summary2[field]
            if old != new:
                changes.append({"scenario": name, "field": field, "v1_value": old, "v2_value": new, "changed": True})
        if not changes:
            changes.append({"scenario": name, "field": "no_change", "v1_value": None, "v2_value": None, "changed": False})
        facts = []
        # Rule flags are deterministic facts derived from simulated outputs and configured bounds.
        if summary2["charged_outside_window"]:
            facts.append("v2 charged outside configured temperature window")
        if summary2["max_temp_while_charging_c"] is not None and summary2["max_temp_while_charging_c"] > config["max_charge_temp_c"]:
            facts.append("v2 charging temperature exceeded configured maximum")
        if summary2["peak_current_a"] > summary1["peak_current_a"]:
            facts.append("v2 peak current exceeded v1 peak current")
        for row in changes:
            row["rule_flags"] = facts
            result.append(row)
    return result


def main() -> None:
    root = Path(__file__).parent
    simulations = json.loads((root / "sim_output.json").read_text(encoding="utf-8-sig"))
    config = json.loads((root / "config.json").read_text(encoding="utf-8-sig"))
    output = build_diffs(simulations, config)
    (root / "diff_output.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(output)} scenario/field records to diff_output.json")


if __name__ == "__main__":
    main()
