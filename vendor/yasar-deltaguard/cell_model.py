def ocv_from_soc(soc: float) -> float:
    # ASSUMPTION: monotonic piecewise-linear OCV curve; not a chemistry model.
    points = [(0.0, 3.0), (0.2, 3.45), (0.5, 3.7), (0.8, 3.95), (1.0, 4.2)]
    soc = min(1.0, max(0.0, soc))
    for (s0, v0), (s1, v1) in zip(points, points[1:]):
        if soc <= s1:
            return v0 + (v1 - v0) * (soc - s0) / (s1 - s0)
    return 4.2


def terminal_voltage(soc: float, current_a: float, config: dict) -> float:
    return ocv_from_soc(soc) + current_a * config["internal_resistance_ohm"]


def advance_soc(soc: float, current_a: float, dt_s: float, capacity_mah: float) -> float:
    # ASSUMPTION: ideal coulomb counting with no efficiency or self-discharge losses.
    capacity_ah = capacity_mah / 1000
    return min(1.0, max(0.0, soc + current_a * dt_s / (capacity_ah * 3600)))
