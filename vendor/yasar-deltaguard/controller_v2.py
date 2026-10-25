def step(state: dict, config: dict, fault_flags: list[str]) -> dict:
    # REGRESSION 3: temp_sensor_fail is ignored; other fault flags still cut off.
    other_faults = [flag for flag in fault_flags if flag != "temp_sensor_fail"]
    if other_faults:
        return {"requested_current_a": 0.0, "mode": "CUTOFF", "cutoff": True,
                "reason": f"fault: {other_faults[0]}"}
    temp = state["temperature_c"]
    # REGRESSION 1: upper limit is incorrectly fixed at 50 C instead of config.
    if temp < config["min_charge_temp_c"] or temp > 50:
        return {"requested_current_a": 0.0, "mode": "CUTOFF", "cutoff": True,
                "reason": "temperature outside charge window"}
    # REGRESSION 2: cold derating is removed; standard rate is always used.
    current = config["capacity_mah"] / 1000 * config["std_charge_c_rate"]
    if state["voltage_v"] + current * config["internal_resistance_ohm"] >= config["charge_voltage_v"]:
        # ASSUMPTION: CV current holds terminal voltage exactly at the configured limit.
        current = max(0.0, (config["charge_voltage_v"] - state["voltage_v"]) / config["internal_resistance_ohm"])
        if current * 1000 < config["cutoff_current_ma"]:
            return {"requested_current_a": 0.0, "mode": "CUTOFF", "cutoff": True, "reason": "charge complete"}
        return {"requested_current_a": current, "mode": "CV", "cutoff": False, "reason": "voltage regulation"}
    return {"requested_current_a": current, "mode": "CC", "cutoff": False, "reason": "charging"}
