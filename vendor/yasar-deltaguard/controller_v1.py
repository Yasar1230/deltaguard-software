def step(state: dict, config: dict, fault_flags: list[str]) -> dict:
    if fault_flags:
        return {"requested_current_a": 0.0, "mode": "CUTOFF", "cutoff": True,
                "reason": f"fault: {fault_flags[0]}"}
    temp = state["temperature_c"]
    if temp < config["min_charge_temp_c"] or temp > config["max_charge_temp_c"]:
        return {"requested_current_a": 0.0, "mode": "CUTOFF", "cutoff": True,
                "reason": "temperature outside charge window"}
    rate = config["cold_charge_c_rate"] if temp < config["cold_threshold_c"] else config["std_charge_c_rate"]
    current = config["capacity_mah"] / 1000 * rate
    if state["voltage_v"] + current * config["internal_resistance_ohm"] >= config["charge_voltage_v"]:
        # ASSUMPTION: CV current holds terminal voltage exactly at the configured limit.
        current = max(0.0, (config["charge_voltage_v"] - state["voltage_v"]) / config["internal_resistance_ohm"])
        if current * 1000 < config["cutoff_current_ma"]:
            return {"requested_current_a": 0.0, "mode": "CUTOFF", "cutoff": True, "reason": "charge complete"}
        return {"requested_current_a": current, "mode": "CV", "cutoff": False, "reason": "voltage regulation"}
    return {"requested_current_a": current, "mode": "COLD_DERATED" if temp < config["cold_threshold_c"] else "CC",
            "cutoff": False, "reason": "charging"}
