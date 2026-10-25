import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareResults, FIXED_DT_S, GRAVITY_MPS2, runSimulation } from '../src/sim_core.js';
import { controllerCommand, parseUpdatePackageJson, validateUpdatePackage } from '../src/controller.js';
import { SCENARIOS, validateScenario } from '../src/scenarios.js';

const v1 = JSON.parse(await readFile(new URL('../updates/update_v1.json', import.meta.url), 'utf8'));
const v2 = JSON.parse(await readFile(new URL('../updates/update_v2.json', import.meta.url), 'utf8'));
const scenario = id => structuredClone(SCENARIOS.find(s => s.id === id));
const run = (s, pkg = v1) => runSimulation({ scenario: s, updatePackage: pkg });

test('fixed-step deterministic reruns and seeded sensor noise', () => {
  assert.equal(FIXED_DT_S, 0.02);
  const noisy = structuredClone(v1); noisy.params.sensor_noise_std_m = 0.35;
  const s = scenario('lead_brake');
  assert.deepEqual(run(s, noisy), run(s, noisy));
});

test('free-road control case coasts without fabricated target or fault', () => {
  const result = run(scenario('free_road'));
  assert.equal(result.metrics.ended_by, 'simulation_timeout');
  assert.equal(result.metrics.collision, false);
  assert.equal(result.metrics.min_gap_m, null);
  assert.ok(result.trace.every(p => p.sensor.valid && p.sensor.target_id === null && p.controller.mode === 'ACC_NO_TARGET'));
  assert.ok(result.trace.every(p => p.ego.speed_mps === 15));
});

test('out-of-range truth is not exposed as a valid sensor detection', () => {
  const s = { id: 'out_of_range', duration_s: 2, seed: 11, friction: 0.9,
    ego: { position_m: 0, speed_mps: 10, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'far', type: 'car', position_m: 130, speed_mps: 10, lane: 0, length_m: 4.6 }], events: [], sensor_dropouts: [] };
  const result = run(s);
  assert.equal(result.trace[0].ground_truth_target.id, 'far');
  assert.equal(result.trace[0].sensor.valid, true);
  assert.equal(result.trace[0].sensor.target_id, null);
  assert.equal(result.trace[0].sensor.gap_m, null);
  assert.equal(result.trace[0].t_s, 0);
  assert.equal(result.trace.at(-1).t_s, s.duration_s);
});

test('controller ACC calculation saturates and emergency braking bypasses comfort deceleration', () => {
  const far = controllerCommand({ params: v1.params, ego: { speedMps: 20 },
    measurement: { valid: true, gapM: 100, speedMps: 20 }, sensorInvalidForS: 0, lastValidMeasurement: null });
  assert.equal(far.targetAccelMps2, v1.params.max_accel_mps2);
  const urgent = controllerCommand({ params: v1.params, ego: { speedMps: 20 },
    measurement: { valid: true, gapM: 4, speedMps: 10 }, sensorInvalidForS: 0, lastValidMeasurement: null });
  assert.equal(urgent.mode, 'AEB');
  assert.equal(urgent.targetAccelMps2, -v1.params.aeb_decel_mps2);
  assert.ok(-urgent.targetAccelMps2 > v1.params.comfort_decel_mps2);
  assert.equal(urgent.ttcS, 0.4);
  const invalid = controllerCommand({ params: v1.params, ego: { speedMps: 20 },
    measurement: { valid: false, gapM: null, speedMps: null }, sensorInvalidForS: 0.1, lastValidMeasurement: null });
  assert.equal(invalid.mode, 'SENSOR_INVALID_WAIT');
  assert.equal(invalid.targetAccelMps2, 0);
});

test('normal acceleration obeys jerk limit; emergency deceleration obeys friction limit', () => {
  const free = run(scenario('free_road'));
  assert.ok(Math.abs(free.trace[1].ego.acceleration_mps2) <= v1.params.max_jerk_mps3 * FIXED_DT_S + 1e-9);
  const wet = run(scenario('wet_lead_brake'));
  assert.ok(wet.metrics.peak_deceleration_mps2 <= 0.4 * GRAVITY_MPS2 + 1e-6);
  assert.ok(wet.trace.every(p => p.ego.speed_mps >= 0));
});

test('lead braking can produce a safe stop and records AEB activation/clear semantics', () => {
  const s = { id: 'safe_stop', duration_s: 12, seed: 44, friction: 0.9,
    ego: { position_m: 0, speed_mps: 10, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'lead', type: 'car', position_m: 19.6, speed_mps: 0, lane: 0, length_m: 4.6 }], events: [], sensor_dropouts: [] };
  const result = run(s);
  assert.equal(result.metrics.collision, false);
  assert.equal(result.metrics.stopped_safely, true);
  assert.equal(result.metrics.ended_by, 'stopped_safely');
  assert.ok(result.metrics.min_gap_m > 0);
  assert.ok(result.metrics.min_valid_ttc_s > 0);
  assert.equal(result.events.filter(e => e.type === 'AEB_ACTIVE').length, 1);
  assert.equal(result.events.filter(e => e.type === 'STOPPED_SAFELY').length, 1);
  assert.ok(result.metrics.peak_deceleration_mps2 <= s.friction * GRAVITY_MPS2 + 1e-6);
});

test('collision uses bumper gap, reports time and impact speed, then terminates', () => {
  const s = { id: 'impact', duration_s: 4, seed: 8, friction: 0.9,
    ego: { position_m: 0, speed_mps: 12, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'wall', type: 'obstacle', position_m: 7, speed_mps: 0, lane: 0, length_m: 1 }], events: [], sensor_dropouts: [] };
  const result = run(s);
  assert.equal(result.metrics.collision, true);
  assert.ok(result.metrics.collision_time_s !== null);
  assert.ok(result.metrics.impact_speed_mps > 0);
  assert.equal(result.events.filter(e => e.type === 'COLLISION').length, 1);
  assert.equal(result.metrics.ended_by, 'collision');
  assert.equal(result.trace.at(-1).ego.collision, true);
  const contact = { id: 'boundary_contact', duration_s: 0.02, seed: 9, friction: 0.9,
    ego: { position_m: 0, speed_mps: 0, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'wall', type: 'obstacle', position_m: 2.8, speed_mps: 0, lane: 0, length_m: 1 }], events: [], sensor_dropouts: [] };
  const boundary = run(contact);
  assert.equal(boundary.metrics.collision, true);
  assert.equal(boundary.metrics.collision_time_s, 0);
});

test('sensor fault timeout and recovery are timestamped once with deterministic hold-last response', () => {
  const pkg = structuredClone(v1); pkg.params.fault_response = 'hold_last_valid_reading';
  const s = scenario('sensor_dropout');
  const result = run(s, pkg);
  const faults = result.events.filter(e => e.type === 'SENSOR_FAULT');
  const clears = result.events.filter(e => e.type === 'SENSOR_FAULT_CLEARED');
  assert.equal(faults.length, 1);
  assert.equal(clears.length, 1);
  assert.ok(faults[0].t_s >= 2.5);
  assert.ok(clears[0].t_s >= 3.2);
  assert.ok(result.trace.some(p => p.controller.mode === 'ACC_HOLD'));
  assert.equal(typeof result.metrics.collision, 'boolean');
});

test('brake-gently and disengage fault responses are distinct', () => {
  const base = { ego: { speedMps: 12 }, measurement: { valid: false, gapM: null, speedMps: null },
    sensorInvalidForS: 1, lastValidMeasurement: null };
  const gentle = controllerCommand({ ...base, params: v1.params });
  const disengageParams = { ...v1.params, fault_response: 'disengage' };
  const disengaged = controllerCommand({ ...base, params: disengageParams });
  assert.equal(gentle.mode, 'SENSOR_FAULT_BRAKE');
  assert.ok(gentle.targetAccelMps2 < 0);
  assert.equal(disengaged.mode, 'SENSOR_FAULT_DISENGAGE');
  assert.equal(disengaged.targetAccelMps2, 0);
});

test('scenario traffic events fire once at scheduled simulation time; pedestrian and cut-in are modeled', () => {
  const braking = run(scenario('lead_brake'));
  const brakeEvent = braking.events.filter(e => e.type === 'SCENARIO_EVENT' && e.event_type === 'lead_brake');
  assert.deepEqual(brakeEvent.map(e => e.t_s), [2]);
  const leadSnapshot = braking.trace[0].ground_truth_target;
  assert.equal(leadSnapshot.position_m, scenario('lead_brake').traffic[0].position_m);
  assert.equal(leadSnapshot.lane, scenario('lead_brake').traffic[0].lane);
  assert.equal(leadSnapshot.type, 'car');
  assert.equal(braking.trace[0].traffic_state[0].position_m, leadSnapshot.position_m);
  const cutin = run(scenario('cut_in'));
  assert.deepEqual(cutin.events.filter(e => e.type === 'SCENARIO_EVENT' && e.event_type === 'cut_in').map(e => e.t_s), [2]);
  assert.ok(cutin.trace.some(p => p.ground_truth_target?.id === 'cutter'));
  const observedCutin = cutin.trace.find(p => p.ground_truth_target?.id === 'cutter');
  assert.ok(observedCutin.ground_truth_target.lane < 1);
  assert.ok(observedCutin.ground_truth_target.lane >= 0);
  assert.equal(cutin.trace.find(p => p.t_s === 2.5).traffic_state[0].lane, 0.52);
  const pedestrian = run(scenario('pedestrian_crossing'));
  assert.deepEqual(pedestrian.events.filter(e => e.type === 'SCENARIO_EVENT' && e.event_type === 'pedestrian_appear').map(e => e.t_s), [1]);
  assert.ok(pedestrian.trace.some(p => p.ground_truth_target?.id === 'pedestrian'));
});

test('package validation rejects malformed, missing, unknown, nonfinite, and out-of-bound data', () => {
  assert.equal(validateUpdatePackage(v1).valid, true);
  assert.throws(() => parseUpdatePackageJson('{oops'), /malformed/);
  assert.throws(() => parseUpdatePackageJson(JSON.stringify({ ...v1, extra: true })), /unknown package field/);
  const missing = structuredClone(v1); delete missing.params.aeb_ttc_s;
  assert.match(validateUpdatePackage(missing).errors.join(' '), /params.aeb_ttc_s: required field is missing/);
  const invalid = structuredClone(v1); invalid.params.aeb_decel_mps2 = 99;
  assert.match(validateUpdatePackage(invalid).errors.join(' '), /params.aeb_decel_mps2: expected a value/);
  const string = structuredClone(v1); string.params.time_headway_s = '1.6';
  assert.match(validateUpdatePackage(string).errors.join(' '), /expected a finite JSON number/);
  assert.throws(() => runSimulation({ scenario: scenario('free_road'), updatePackage: { ...v1, params: { ...v1.params, sensor_noise_std_m: Infinity } } }), /Invalid update package/);
});

test('all bundled scenarios and packages satisfy strict schemas', () => {
  for (const s of SCENARIOS) assert.deepEqual(validateScenario(s), [], s.id);
  assert.deepEqual(validateUpdatePackage(v1), { valid: true, errors: [] });
  assert.deepEqual(validateUpdatePackage(v2), { valid: true, errors: [] });
  const malformed = scenario('free_road'); malformed.traffic = [null];
  assert.ok(validateScenario(malformed).some(e => e.startsWith('traffic:')));
  const unknown = scenario('free_road'); unknown.surprise = true;
  assert.ok(validateScenario(unknown).some(e => e.includes('surprise: unknown')));
});

test('comparison requires identical run conditions and derives safety evidence from actual results', () => {
  const s = scenario('lead_brake');
  const a = run(s, v1), b = run(s, v2);
  const diff = compareResults(a, b);
  assert.deepEqual(diff.parameter_differences, [{ field: 'aeb_ttc_s', v1_value: 2, v2_value: 1 }]);
  assert.equal(typeof diff.v2_worse_on_safety, 'boolean');
  assert.equal(diff.v2_worse_on_safety, diff.evidence.collision_introduced || diff.evidence.safe_stop_lost ||
    (diff.evidence.impact_speed_increased_mps !== null && diff.evidence.impact_speed_increased_mps > 0) ||
    (diff.evidence.minimum_gap_decreased_m !== null && diff.evidence.minimum_gap_decreased_m < -1e-6) ||
    (diff.evidence.minimum_ttc_decreased_s !== null && diff.evidence.minimum_ttc_decreased_s < -1e-6));
  const mismatched = structuredClone(b); mismatched.run_config.seed++;
  assert.throws(() => compareResults(a, mismatched), /not comparable/);
  const changedTruth = structuredClone(b); changedTruth.scenario_input.ego.speed_mps++;
  assert.throws(() => compareResults(a, changedTruth), /not comparable/);
  const obstacle = scenario('stationary_obstacle');
  const safeBaseline = run(obstacle, v1), regressedCandidate = run(obstacle, v2);
  const observed = compareResults(safeBaseline, regressedCandidate);
  assert.equal(safeBaseline.metrics.stopped_safely, true);
  assert.equal(regressedCandidate.metrics.collision, true);
  assert.equal(observed.v2_worse_on_safety, true);
  assert.equal(observed.evidence.collision_introduced, true);
});
