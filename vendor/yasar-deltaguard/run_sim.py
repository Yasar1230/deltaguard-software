import json
from pathlib import Path

import cell_model
import controller_v1
import controller_v2


def temperature_at(profile: list[dict], t_s: float) -> float:
    # ASSUMPTION: profile values are piecewise-linear; values outside its time range use endpoints.
    if t_s <= profile[0]["t_s"]:
        return profile[0]["temp_c"]
    for left, right in zip(profile, profile[1:]):
        if t_s <= right["t_s"]:
            fraction = (t_s - left["t_s"]) / (right["t_s"] - left["t_s"])
            return left["temp_c"] + fraction * (right["temp_c"] - left["temp_c"])
    return profile[-1]["temp_c"]


def simulate(scenario: dict, config: dict, controller) -> dict:
    dt = config["time_step_s"]
    soc = scenario["initial_soc"]
    trace = []
    peak = 0.0
    max_temp = None
    charged_outside = False
    elapsed = 0
    ended_by = "duration limit reached"
    for t_s in range(0, scenario["duration_s"] + 1, dt):
        temp = temperature_at(scenario["temperature_profile"], t_s)
        state = {"soc": soc, "temperature_c": temp, "voltage_v": cell_model.terminal_voltage(soc, 0.0, config), "time_s": t_s}
        decision = controller.step(state, config, scenario["fault_flags"])
        current = decision["requested_current_a"]
        voltage = cell_model.terminal_voltage(soc, current, config)
        outside = temp < config["min_charge_temp_c"] or temp > config["max_charge_temp_c"]
        if current > 0:
            peak = max(peak, current)
            max_temp = temp if max_temp is None else max(max_temp, temp)
            charged_outside |= outside
        trace.append({"t_s": t_s, "temp_c": round(temp, 4), "soc": round(soc, 6), "voltage_v": round(voltage, 6),
                      "current_a": round(current, 6), "mode": decision["mode"], "cutoff": decision["cutoff"], "reason": decision["reason"]})
        if decision["cutoff"]:
            ended_by = decision["reason"]
            elapsed = t_s
            break
        soc = cell_model.advance_soc(soc, current, dt, config["capacity_mah"])
        elapsed = t_s + dt
    summary = {"final_soc": round(soc, 6), "peak_current_a": round(peak, 6),
               "max_temp_while_charging_c": None if max_temp is None else round(max_temp, 4),
               "charge_time_s": elapsed, "ended_by": ended_by, "charged_outside_window": charged_outside}
    return {"summary": summary, "trace": trace}


def main() -> None:
    root = Path(__file__).parent
    config = json.loads((root / "config.json").read_text(encoding="utf-8-sig"))
    scenarios = json.loads((root / "scenarios.json").read_text(encoding="utf-8-sig"))
    output = {}
    for scenario in scenarios:
        output[scenario["name"]] = {
            "v1": simulate(scenario, config, controller_v1),
            "v2": simulate(scenario, config, controller_v2),
        }
    (root / "sim_output.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"Simulated {len(scenarios)} scenarios for v1 and v2; wrote sim_output.json")


if __name__ == "__main__":
    main()
