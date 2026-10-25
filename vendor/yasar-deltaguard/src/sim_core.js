import { controllerCommand, requireValidUpdatePackage } from './controller.js';
import { validateScenario } from './scenarios.js';

export const FIXED_DT_S = 0.02;
export const GRAVITY_MPS2 = 9.81;

/** Pure deterministic longitudinal simulator. Coordinates increase along the road; SI units are used throughout. */
export function runSimulation({ scenario, updatePackage, seed = scenario?.seed, durationS = scenario?.duration_s }) {
  requireValidUpdatePackage(updatePackage);
  const scenarioErrors = validateScenario(scenario);
  if (scenarioErrors.length) throw new TypeError(`Invalid scenario: ${scenarioErrors.join('; ')}`);
  if (seed !== scenario.seed) throw new TypeError('Comparison seed must equal the scenario seed');
  if (durationS !== scenario.duration_s) throw new TypeError('Comparison duration must equal the scenario duration');
  const params = updatePackage.params;
  const rng = makeRng(seed);
  const ego = { ...scenario.ego, accelerationMps2: 0, stopped: false, collision: false };
  const startedMoving = ego.speed_mps > 0;
  const traffic = scenario.traffic.map(v => ({ ...v, accelerationMps2: 0, stopped: v.speed_mps === 0, collision: false, brakeMps2: 0 }));
  const pedestrians = (scenario.pedestrians || []).map(p => ({ ...p, active: false, initialLane: p.lane, collision: false }));
  const fired = new Set();
  const eventLog = [];
  const trace = [];
  const eventState = { aeb: false, sensorFault: false };
  let lastValidMeasurement = null;
  let sensorInvalidForS = 0;
  let minGapM = null;
  let minValidTtcS = null;
  let peakDecelerationMps2 = 0;
  let timeInAebS = 0;
  let collision = false;
  let impactSpeedMps = null;
  let stoppedSafely = false;
  const stepCount = Math.round(durationS / FIXED_DT_S);

  for (let tick = 0; tick <= stepCount; tick++) {
    const timeS = round(tick * FIXED_DT_S, 8);
    applyTrafficEvents(scenario, timeS, fired, traffic, pedestrians, eventLog);
    advancePedestrians(pedestrians, timeS);

    const target = nearestTarget(ego, traffic, pedestrians);
    const inDropout = scenario.sensor_dropouts.some(w => timeS >= w.start_s && timeS < w.end_s);
    let measurement = { valid: !inDropout, gapM: null, speedMps: null, targetId: null, held: false };
    if (!inDropout && target && target.gapM <= params.sensor_detection_range_m) {
      const noisyGap = Math.max(0, target.gapM + gaussianNoise(rng) * params.sensor_noise_std_m);
      measurement = { valid: true, gapM: noisyGap, speedMps: target.speedMps, targetId: target.id, held: false };
      lastValidMeasurement = { ...measurement };
    }
    if (measurement.valid) sensorInvalidForS = 0;

    const collisionTarget = nearestTarget(ego, traffic, pedestrians, true);
    if (collisionTarget) {
      collision = true;
      ego.collision = true;
      if (collisionTarget.vehicle) collisionTarget.vehicle.collision = true;
      impactSpeedMps = Math.abs(ego.speed_mps - collisionTarget.speedMps);
      eventLog.push({ t_s: timeS, type: 'COLLISION', target_id: collisionTarget.id, impact_speed_mps: round(impactSpeedMps, 6) });
    }
    const command = controllerCommand({ params, ego: { speedMps: ego.speed_mps }, measurement,
      sensorInvalidForS, lastValidMeasurement });
    if (!measurement.valid && tick < stepCount) sensorInvalidForS = round(sensorInvalidForS + FIXED_DT_S, 8);
    updateEvent(eventState, 'sensorFault', command.sensorFault, 'SENSOR_FAULT', timeS, eventLog);
    updateEvent(eventState, 'aeb', command.aeb, 'AEB_ACTIVE', timeS, eventLog);
    if (command.aeb && tick < stepCount) timeInAebS += FIXED_DT_S;
    const metricTarget = collisionTarget || target;
    if (metricTarget) minGapM = minGapM === null ? metricTarget.gapM : Math.min(minGapM, metricTarget.gapM);
    if (measurement.valid && command.ttcS !== null && command.ttcS !== undefined) {
      minValidTtcS = minValidTtcS === null ? command.ttcS : Math.min(minValidTtcS, command.ttcS);
    }

    const thisMeasurement = measurement.valid ? measurement : null;
    if (!collision && startedMoving && ego.speed_mps <= 0.05 && thisMeasurement && thisMeasurement.gapM > 0) {
      if (!stoppedSafely) eventLog.push({ t_s: timeS, type: 'STOPPED_SAFELY' });
      stoppedSafely = true;
    }
    const visibleTarget = target || collisionTarget;
    trace.push({ t_s: timeS, ego: vehicleSnapshot(ego), traffic_state: traffic.map(v => ({
      id: v.id, type: v.type, position_m: round(v.position_m, 6), speed_mps: round(v.speed_mps, 6),
      lane: round(v.lane, 6), length_m: v.length_m, braking: v.brakeMps2 > 0,
    })), ground_truth_target: visibleTarget ? {
      id: visibleTarget.id, type: visibleTarget.pedestrian ? 'pedestrian' : visibleTarget.vehicle?.type || 'car',
      gap_m: round(visibleTarget.gapM, 6), speed_mps: round(visibleTarget.speedMps, 6),
      position_m: round(visibleTarget.vehicle?.position_m ?? visibleTarget.pedestrian?.position_m, 6),
      lane: round(visibleTarget.vehicle?.lane ?? visibleTarget.pedestrian?.lane, 6),
    } : null,
      sensor: { valid: measurement.valid, held: Boolean(measurement.held), gap_m: measurement.gapM === null ? null : round(measurement.gapM, 6), target_id: measurement.targetId },
      controller: { mode: command.mode, target_accel_mps2: round(command.targetAccelMps2, 6), aeb: command.aeb, ttc_s: command.ttcS == null ? null : round(command.ttcS, 6) },
      friction_limit_mps2: round(scenario.friction * GRAVITY_MPS2, 6) });

    if (collision || stoppedSafely || tick === stepCount) break;
    const frictionLimit = scenario.friction * GRAVITY_MPS2;
    const emergency = command.aeb;
    const physicalTarget = clamp(command.targetAccelMps2, -frictionLimit, params.max_accel_mps2);
    let acceleration = physicalTarget;
    if (!emergency) {
      const maxDelta = params.max_jerk_mps3 * FIXED_DT_S;
      acceleration = clamp(physicalTarget, ego.accelerationMps2 - maxDelta, ego.accelerationMps2 + maxDelta);
      acceleration = clamp(acceleration, -frictionLimit, params.max_accel_mps2);
    }
    const oldSpeed = ego.speed_mps;
    const newSpeed = Math.max(0, oldSpeed + acceleration * FIXED_DT_S);
    const realizedAcceleration = (newSpeed - oldSpeed) / FIXED_DT_S;
    ego.position_m += (oldSpeed + newSpeed) * 0.5 * FIXED_DT_S;
    ego.speed_mps = newSpeed;
    ego.accelerationMps2 = realizedAcceleration;
    ego.stopped = newSpeed <= 1e-9;
    peakDecelerationMps2 = Math.max(peakDecelerationMps2, Math.max(0, -realizedAcceleration));
    advanceTraffic(traffic, FIXED_DT_S, scenario.friction, timeS);
  }
  const metrics = {
    min_gap_m: finiteOrNull(minGapM),
    min_valid_ttc_s: finiteOrNull(minValidTtcS),
    peak_deceleration_mps2: round(peakDecelerationMps2, 6),
    time_in_aeb_s: round(timeInAebS, 6),
    collision,
    collision_time_s: collision ? trace.at(-1).t_s : null,
    impact_speed_mps: finiteOrNull(impactSpeedMps),
    stopped_safely: stoppedSafely,
    ended_by: collision ? 'collision' : stoppedSafely ? 'stopped_safely' : 'simulation_timeout',
  };
  return { scenario_id: scenario.id, package_id: updatePackage.package_id, package_version: updatePackage.version,
    package_params: { ...params }, scenario_input: structuredClone(scenario),
    run_config: { dt_s: FIXED_DT_S, seed, friction: scenario.friction, duration_s: durationS }, metrics, events: eventLog, trace };
}

export function compareResults(baseline, candidate) {
  if (baseline.scenario_id !== candidate.scenario_id || baseline.run_config.seed !== candidate.run_config.seed ||
      baseline.run_config.dt_s !== candidate.run_config.dt_s || baseline.run_config.friction !== candidate.run_config.friction ||
      baseline.run_config.duration_s !== candidate.run_config.duration_s || stableStringify(baseline.scenario_input) !== stableStringify(candidate.scenario_input)) {
    throw new TypeError('Results are not comparable: scenario, seed, timestep, friction, and duration must match');
  }
  const a = baseline.metrics, b = candidate.metrics;
  const evidence = {
    collision_introduced: !a.collision && b.collision,
    impact_speed_increased_mps: b.collision && a.collision ? round(b.impact_speed_mps - a.impact_speed_mps, 6) : null,
    minimum_gap_decreased_m: a.min_gap_m !== null && b.min_gap_m !== null ? round(b.min_gap_m - a.min_gap_m, 6) : null,
    minimum_ttc_decreased_s: a.min_valid_ttc_s !== null && b.min_valid_ttc_s !== null ? round(b.min_valid_ttc_s - a.min_valid_ttc_s, 6) : null,
    safe_stop_lost: a.stopped_safely && !b.stopped_safely,
  };
  // Objective rule: worse if a collision is introduced, impact speed rises when both collide,
  // safety margin (minimum gap or valid TTC) falls, or a baseline safe stop is lost.
  const v2Worse = evidence.collision_introduced || evidence.safe_stop_lost ||
    (evidence.impact_speed_increased_mps !== null && evidence.impact_speed_increased_mps > 0) ||
    (evidence.minimum_gap_decreased_m !== null && evidence.minimum_gap_decreased_m < -1e-6) ||
    (evidence.minimum_ttc_decreased_s !== null && evidence.minimum_ttc_decreased_s < -1e-6);
  return { scenario_id: baseline.scenario_id, baseline_package: `${baseline.package_id}@${baseline.package_version}`,
    candidate_package: `${candidate.package_id}@${candidate.package_version}`, parameter_differences: parameterDifferences(baseline, candidate),
    v2_worse_on_safety: v2Worse, evidence };
}

function applyTrafficEvents(scenario, t, fired, traffic, pedestrians, events) {
  for (let i = 0; i < scenario.events.length; i++) {
    const e = scenario.events[i];
    if (!fired.has(i) && Math.abs(e.at_s - t) < 1e-8) {
      fired.add(i);
      if (e.type === 'lead_brake') {
        const v = traffic.find(v => v.id === e.vehicle_id);
        v.brakeMps2 = e.decel_mps2;
      } else if (e.type === 'cut_in') {
        const v = traffic.find(v => v.id === e.vehicle_id);
        v.cutIn = { start_s: e.at_s, end_s: e.at_s + e.duration_s, fromLane: v.lane, toLane: 0 };
      } else if (e.type === 'pedestrian_appear') {
        const p = pedestrians.find(p => p.id === e.pedestrian_id);
        p.active = true;
        p.crossingStartS = e.at_s;
        p.crossingEndS = e.at_s + e.crossing_duration_s;
      }
      events.push({ t_s: t, type: 'SCENARIO_EVENT', event_type: e.type, target_id: e.vehicle_id || e.pedestrian_id || null });
    }
  }
}

function advanceTraffic(traffic, dt, mu, timeS) {
  const limit = mu * GRAVITY_MPS2;
  for (const v of traffic) {
    if (v.cutIn) {
      const f = clamp((timeS - v.cutIn.start_s) / (v.cutIn.end_s - v.cutIn.start_s), 0, 1);
      v.lane = v.cutIn.fromLane + (v.cutIn.toLane - v.cutIn.fromLane) * f;
    }
    const a = -Math.min(v.brakeMps2, limit);
    const next = Math.max(0, v.speed_mps + a * dt);
    v.position_m += (v.speed_mps + next) * 0.5 * dt;
    v.speed_mps = next;
    v.stopped = next <= 1e-9;
  }
}

function advancePedestrians(pedestrians, t) {
  for (const p of pedestrians) {
    if (!p.active) continue;
    const f = clamp((t - p.crossingStartS) / (p.crossingEndS - p.crossingStartS), 0, 1);
    p.lane = p.initialLane + (0 - p.initialLane) * f;
    p.crossing = t <= p.crossingEndS && f < 1;
    p.speedMps = 0;
  }
}

function nearestTarget(ego, traffic, pedestrians, collisionOnly = false) {
  const candidates = [];
  for (const v of traffic) {
    if (Math.abs(v.lane - ego.lane) > 0.5) continue;
    const gapM = v.position_m - v.length_m / 2 - (ego.position_m + ego.length_m / 2);
    const overlaps = gapM <= 0 && gapM > -(ego.length_m + v.length_m);
    if (collisionOnly ? overlaps : gapM >= 0) candidates.push({ id: v.id, gapM, speedMps: v.speed_mps, lengthM: v.length_m, vehicle: v });
  }
  for (const p of pedestrians) {
    if (!p.active || !p.crossing || Math.abs(p.lane - ego.lane) > 0.5) continue;
    const gapM = p.position_m - p.width_m / 2 - (ego.position_m + ego.length_m / 2);
    const overlaps = gapM <= 0 && gapM > -(ego.length_m + p.width_m);
    if (collisionOnly ? overlaps : gapM >= 0) candidates.push({ id: p.id, gapM, speedMps: 0, lengthM: p.width_m, pedestrian: p });
  }
  candidates.sort((a,b) => a.gapM - b.gapM || a.id.localeCompare(b.id));
  return candidates[0] || null;
}

function updateEvent(state, key, active, type, t, events) {
  if (active && !state[key]) events.push({ t_s: t, type });
  if (!active && state[key]) events.push({ t_s: t, type: `${type}_CLEARED` });
  state[key] = active;
}
function vehicleSnapshot(v) { return { position_m: round(v.position_m, 6), speed_mps: round(v.speed_mps, 6), acceleration_mps2: round(v.accelerationMps2, 6), lane: round(v.lane, 6), stopped: v.stopped, collision: v.collision }; }
function parameterDifferences(baseline, candidate) {
  const result = [];
  for (const key of Object.keys(baseline.package_params || {})) if (baseline.package_params[key] !== candidate.package_params?.[key]) result.push({ field: key, v1_value: baseline.package_params[key], v2_value: candidate.package_params[key] });
  return result;
}
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function makeRng(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
}
function gaussianNoise(rng) {
  const u1 = Math.max(Number.EPSILON, rng()), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function clamp(x, min, max) { return Math.min(max, Math.max(min, x)); }
function finiteOrNull(x) { return x === null || !Number.isFinite(x) ? null : round(x, 6); }
function round(x, places) { const scale = 10 ** places; return Math.round((x + Number.EPSILON) * scale) / scale; }
