# DeltaGuard 3D - Phase 3 comparison

DeltaGuard is an illustrative, deterministic traffic simulation for comparing parameter-only controller packages. It is not a validated vehicle model, ADAS product, or certified safety tool.

## View Phase 3

From the project folder, start the static server in PowerShell:

```powershell
node .\serve_phase2.mjs
```

If `node` is not on PATH, use the bundled runtime:

```powershell
& 'C:\Users\aalaya\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\serve_phase2.mjs
```

Open [http://127.0.0.1:8766/](http://127.0.0.1:8766/). Choose a scenario, optionally load a candidate JSON package, and run the synchronized comparison. Keep the server terminal open. Three.js loads from jsDelivr, so the browser needs internet access.

## Run Phase 1

Requires Node.js with ES module support and uses only built-in modules.

```powershell
node --test
```

The bundled Codex runtime used during verification is available at:

```powershell
& 'C:\Users\aalaya\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test
```

## Phase 1 files

- `src/sim_core.js`: pure fixed-step runner, seeded sensor noise, traffic actions, event history, metrics, result comparison.
- `src/controller.js`: package schema validation, ACC, AEB, and three sensor fault responses.
- `src/scenarios.js`: scenario definitions and strict scenario validation.
- `updates/update_v1.json`, `updates/update_v2.json`: parameter-only example packages.
- `tests/sim_core.test.js`: built-in Node tests.
- `package.json`: enables JavaScript ES modules.

## Package format

Packages contain only JSON data. No uploaded code is imported or executed.

```json
{
  "package_id": "deltaguard-demo",
  "version": "1.0.0",
  "params": {
    "standstill_gap_m": 5.0,
    "time_headway_s": 1.6,
    "max_accel_mps2": 2.0,
    "comfort_decel_mps2": 3.0,
    "max_jerk_mps3": 2.0,
    "aeb_ttc_s": 2.0,
    "aeb_decel_mps2": 7.0,
    "fault_timeout_s": 0.5,
    "fault_response": "brake_gently",
    "sensor_detection_range_m": 120.0,
    "sensor_noise_std_m": 0.0
  }
}
```

Every field is required, unknown fields are rejected, numbers must be finite JSON numbers and within explicit bounds in `src/controller.js`. `fault_response` must be `brake_gently`, `hold_last_valid_reading`, or `disengage`. Example values are illustrative and are not calibrated vehicle settings. The v2 example lowers AEB TTC from 2.0 s to 1.0 s as a deliberately weaker trigger; the referenced original JSON specification containing the intended example packages and regressions was not present in the workspace, so this value must be reconciled against that source before treating it as authoritative.

## Scenario and physics conventions

The scenario supplies an ego vehicle, traffic, friction, seed, duration, discrete timestamped events, and sensor dropout windows. All positions, speeds, accelerations, times, and gaps use SI units. Lane is an integer for stationary traffic; cut-in vehicles transition continuously between lane indices. Pedestrians move laterally across the ego lane over their configured crossing duration while their longitudinal position is held fixed. Their `width_m` is also used as the simplified longitudinal collision extent; this is an explicit geometric assumption, not a human motion model.

The longitudinal coordinate increases in the travel direction. A positive reported gap is the clearance between the ego front bumper and the target rear boundary. For a pedestrian, the target rear boundary is approximated as its longitudinal position minus half its configured width. Overlap is detected using longitudinal boundary intervals while road users occupy the same lane; the first detected overlap ends the run and records relative longitudinal impact speed. A run can also end after a moving ego vehicle brakes to rest with a positive observed target gap (`stopped_safely`), or by reaching the simulation duration (`simulation_timeout`).

The core uses an exact 0.02 s step. Vehicle position uses trapezoidal integration from the old and new speeds; speed is clamped at zero. Normal acceleration is jerk-limited from the previous realized acceleration. AEB bypasses comfort and jerk limits but is clamped to `mu * 9.81 m/sÂ²`; configured emergency deceleration is also capped by that physical limit. ACC desired gap is standstill gap plus time headway times ego speed. TTC is gap divided by positive closing speed and otherwise undefined (`null`).

The sensor sees the nearest object ahead in the ego lane within its configured range. A functioning sensor with no target yields a valid no-target reading. During dropout or invalid detection, the controller waits without adding acceleration until the continuous invalid timer reaches its timeout; then the configured fault response activates. A recovered reading resets the timer. Hold-last uses the last valid gap and target speed while the sensor validity flag remains false. Seeded Box-Muller noise perturbs measured gap only; it does not alter ground truth. Trace fields label sensor readings separately from `ground_truth_target`.

`compareResults()` requires matching scenario inputs, scenario ID, seed, friction, duration, and timestep. Its `v2_worse_on_safety` rule is true when the candidate introduces a collision, increases impact speed when both runs collide, reduces minimum gap or valid TTC, or loses a baseline safe stop. The output includes those objective values as evidence; it does not assign severity.

## Requirements checklist / phase gate

| Requirement | Implementation / evidence | Status |
| --- | --- | --- |
| Fixed 0.02 s deterministic simulation and seeded noise | `src/sim_core.js`; deterministic rerun test | Done |
| ACC, AEB priority, comfort/jerk and friction constraints | `src/controller.js`, `src/sim_core.js`; controller, jerk, wet-road tests | Done |
| Sensor range, validity, noise, dropout timeout and recovery | `src/sim_core.js`; sensor fault tests | Done |
| Bumper gap, collision stop, impact speed, safe stop | `src/sim_core.js`; collision and safe-stop tests | Done |
| Repeatable traffic events, cut-in, obstacle, pedestrian crossing | `src/scenarios.js`, `src/sim_core.js`; event tests | Done |
| Parameter package schema and malformed package rejection | `src/controller.js`; validation tests | Done |
| Actual-run comparison and safety evidence | `compareResults()`; comparison test | Done |
| Single-vehicle 3D scene and telemetry playback | `index.html`, `styles.css`, `src/world3d.js`, `src/ui.js` | Phase 2 done |
| Twin-lane baseline/candidate comparison, validated upload and playback controls | `src/ui.js`, `src/world3d.js`, `src/controller.js` | Phase 3 done |
| Schema-checked results and diff JSON exports | `src/export.js`, `src/downloads.js`, `src/ui.js`; parse and fidelity tests | Phase 4 done |
| Original JSON spec examples/acceptance numbers | Not present in provided workspace | Needs source reconciliation |

## Limitations

This is an illustrative, simplified longitudinal model. It omits steering dynamics, lateral vehicle motion beyond lane interpolation, tire load transfer, vehicle-specific braking curves, road grade, suspension, actuator delays, sensor field of view and occlusion, target classification, map geometry, pedestrian behavior realism, and calibration against measured vehicle data. Traffic and pedestrians do not constitute a complete road-user model. A parameter-only JSON file is not a binary OTA installer. These results must not be used to select real vehicle settings or claim real-world safety.

## Verification record

Acceptance tests were run with Node.js using `node --test`: **17 tests passed, 0 failed**. The core suite covers deterministic reruns, free-road control, sensor range/noise/dropouts and recovery, ACC/AEB, jerk and friction limits, safe stops, collision boundary and impact metrics, scheduled traffic events, package validation, and safety comparison. Four export tests cover parsed JSON fidelity to actual run traces, metrics, events and configuration; timestamp basis; non-finite value normalization; comparability rejection; and schema validation. Phase 3 default twin-lane comparison completed in-browser: both runs stopped safely; candidate minimum gap decreased by 3.88 m and minimum valid TTC by 0.61 s; identical scenario inputs were verified. Upload was exercised with the bundled candidate JSON. Frame-rate characterization and real vehicle behavior have not been tested.

Phase 4 adds `src/export.js` for pure artifact generation/schema validation and `src/downloads.js` for browser downloads. The `results.json` artifact contains both full simulation runs, their timestamped event histories and traces, shared scenario inputs, run configuration, package IDs/versions/parameters, and wall-clock export metadata. `diff.json` contains parameter changes, measured safety evidence and the explicit `v2_worse_on_safety` result. Simulation times remain in simulation seconds; wall-clock metadata is labeled separately. Non-finite numeric values serialize consistently as JSON `null`. Both downloads become available when playback reaches completion and are disabled when a run is reset.
