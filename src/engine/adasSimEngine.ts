export const FIXED_DT_S = 0.02;
export const GRAVITY_MPS2 = 9.81;
export const EXPORT_SCHEMA_VERSION = '1.0.0';

export type FaultResponseMode = 'brake_gently' | 'hold_last_valid_reading' | 'disengage';

export interface AdasPackageParams {
  standstill_gap_m: number;
  time_headway_s: number;
  max_accel_mps2: number;
  comfort_decel_mps2: number;
  max_jerk_mps3: number;
  aeb_ttc_s: number;
  aeb_decel_mps2: number;
  fault_timeout_s: number;
  fault_response: FaultResponseMode;
  sensor_detection_range_m: number;
  sensor_noise_std_m: number;
}

export interface AdasUpdatePackage {
  package_id: string;
  version: string;
  params: AdasPackageParams;
}

export interface AdasTrafficActor {
  id: string;
  type: 'car' | 'obstacle';
  position_m: number;
  speed_mps: number;
  lane: number;
  length_m: number;
}

export interface AdasPedestrianActor {
  id: string;
  position_m: number;
  lane: number;
  width_m: number;
  crossing: boolean;
}

export interface AdasScenarioEvent {
  at_s: number;
  type: 'lead_brake' | 'cut_in' | 'pedestrian_appear';
  vehicle_id?: string;
  decel_mps2?: number;
  duration_s?: number;
  pedestrian_id?: string;
  crossing_duration_s?: number;
}

export interface AdasSensorDropoutWindow {
  start_s: number;
  end_s: number;
}

export interface AdasScenario {
  id: string;
  label: string;
  duration_s: number;
  seed: number;
  friction: number;
  ego: {
    position_m: number;
    speed_mps: number;
    lane: number;
    length_m: number;
  };
  traffic: AdasTrafficActor[];
  pedestrians?: AdasPedestrianActor[];
  events: AdasScenarioEvent[];
  sensor_dropouts: AdasSensorDropoutWindow[];
}

export interface AdasTraceFrame {
  t_s: number;
  ego: {
    position_m: number;
    speed_mps: number;
    acceleration_mps2: number;
    lane: number;
    stopped: boolean;
    collision: boolean;
  };
  traffic_state: Array<{
    id: string;
    type: 'car' | 'obstacle';
    position_m: number;
    speed_mps: number;
    lane: number;
    length_m: number;
    braking: boolean;
  }>;
  pedestrians_state: Array<{
    id: string;
    position_m: number;
    lane: number;
    width_m: number;
    active: boolean;
    crossing: boolean;
  }>;
  ground_truth_target: {
    id: string;
    type: string;
    gap_m: number;
    speed_mps: number;
    position_m: number;
    lane: number;
  } | null;
  sensor: {
    valid: boolean;
    held: boolean;
    gap_m: number | null;
    target_id: string | null;
  };
  controller: {
    mode: string;
    target_accel_mps2: number;
    aeb: boolean;
    ttc_s: number | null;
  };
  friction_limit_mps2: number;
}

export interface AdasRunMetrics {
  min_gap_m: number | null;
  min_valid_ttc_s: number | null;
  peak_deceleration_mps2: number;
  time_in_aeb_s: number;
  collision: boolean;
  collision_time_s: number | null;
  impact_speed_mps: number | null;
  stopped_safely: boolean;
  ended_by: 'collision' | 'stopped_safely' | 'simulation_timeout';
}

export interface AdasSimulationResult {
  scenario_id: string;
  package_id: string;
  package_version: string;
  package_params: AdasPackageParams;
  scenario_input: AdasScenario;
  run_config: {
    dt_s: number;
    seed: number;
    friction: number;
    duration_s: number;
  };
  metrics: AdasRunMetrics;
  events: Array<{
    t_s: number;
    type: string;
    target_id?: string | null;
    event_type?: string;
    impact_speed_mps?: number;
  }>;
  trace: AdasTraceFrame[];
}

export interface AdasComparisonSummary {
  scenario_id: string;
  baseline_package: string;
  candidate_package: string;
  parameter_differences: Array<{
    field: string;
    v1_value: number | string;
    v2_value: number | string;
  }>;
  v2_worse_on_safety: boolean;
  evidence: {
    collision_introduced: boolean;
    impact_speed_increased_mps: number | null;
    minimum_gap_decreased_m: number | null;
    minimum_ttc_decreased_s: number | null;
    safe_stop_lost: boolean;
  };
}

export interface AdasComparisonRun {
  scenario: AdasScenario;
  baseline: AdasSimulationResult;
  candidate: AdasSimulationResult;
  comparison: AdasComparisonSummary;
  durationS: number;
}

export const PARAMETER_BOUNDS: Record<
  Exclude<keyof AdasPackageParams, 'fault_response'>,
  [number, number]
> = {
  standstill_gap_m: [0.5, 20],
  time_headway_s: [0.2, 5],
  max_accel_mps2: [0.1, 5],
  comfort_decel_mps2: [0.1, 5],
  max_jerk_mps3: [0.1, 20],
  aeb_ttc_s: [0.1, 10],
  aeb_decel_mps2: [0.5, 9.81],
  fault_timeout_s: [0, 5],
  sensor_detection_range_m: [1, 300],
  sensor_noise_std_m: [0, 5],
};

const REQUIRED_PARAM_KEYS = [
  ...Object.keys(PARAMETER_BOUNDS),
  'fault_response',
] as Array<keyof AdasPackageParams>;

const FAULT_RESPONSES = new Set<string>([
  'brake_gently',
  'hold_last_valid_reading',
  'disengage',
]);

export const DEFAULT_BASELINE_PACKAGE: AdasUpdatePackage = {
  package_id: 'deltaguard-demo',
  version: '1.0.0',
  params: {
    standstill_gap_m: 5.0,
    time_headway_s: 1.6,
    max_accel_mps2: 2.0,
    comfort_decel_mps2: 3.0,
    max_jerk_mps3: 2.0,
    aeb_ttc_s: 2.0,
    aeb_decel_mps2: 7.0,
    fault_timeout_s: 0.5,
    fault_response: 'brake_gently',
    sensor_detection_range_m: 120.0,
    sensor_noise_std_m: 0.0,
  },
};

export const DEFAULT_CANDIDATE_PACKAGE: AdasUpdatePackage = {
  package_id: 'deltaguard-demo',
  version: '2.0.0',
  params: {
    standstill_gap_m: 5.0,
    time_headway_s: 1.6,
    max_accel_mps2: 2.0,
    comfort_decel_mps2: 3.0,
    max_jerk_mps3: 2.0,
    aeb_ttc_s: 1.0,
    aeb_decel_mps2: 7.0,
    fault_timeout_s: 0.5,
    fault_response: 'brake_gently',
    sensor_detection_range_m: 120.0,
    sensor_noise_std_m: 0.0,
  },
};

export const ADAS_SCENARIOS: ReadonlyArray<AdasScenario> = Object.freeze([
  {
    id: 'lead_brake',
    label: 'Lead vehicle hard braking',
    duration_s: 12,
    seed: 202,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 22, lane: 0, length_m: 4.6 },
    traffic: [
      { id: 'lead', type: 'car', position_m: 32.6, speed_mps: 18, lane: 0, length_m: 4.6 },
    ],
    events: [{ at_s: 2, type: 'lead_brake', vehicle_id: 'lead', decel_mps2: 6 }],
    sensor_dropouts: [],
  },
  {
    id: 'wet_lead_brake',
    label: 'Wet road lead braking',
    duration_s: 12,
    seed: 303,
    friction: 0.4,
    ego: { position_m: 0, speed_mps: 20, lane: 0, length_m: 4.6 },
    traffic: [
      { id: 'lead', type: 'car', position_m: 28.6, speed_mps: 16, lane: 0, length_m: 4.6 },
    ],
    events: [{ at_s: 1.5, type: 'lead_brake', vehicle_id: 'lead', decel_mps2: 6 }],
    sensor_dropouts: [],
  },
  {
    id: 'sensor_dropout',
    label: 'Sensor dropout during lead braking',
    duration_s: 12,
    seed: 404,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 20, lane: 0, length_m: 4.6 },
    traffic: [
      { id: 'lead', type: 'car', position_m: 27.6, speed_mps: 15, lane: 0, length_m: 4.6 },
    ],
    events: [{ at_s: 1, type: 'lead_brake', vehicle_id: 'lead', decel_mps2: 5 }],
    sensor_dropouts: [{ start_s: 2, end_s: 3.2 }],
  },
  {
    id: 'cut_in',
    label: 'Adjacent vehicle cut-in',
    duration_s: 12,
    seed: 505,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 18, lane: 0, length_m: 4.6 },
    traffic: [
      { id: 'cutter', type: 'car', position_m: 23, speed_mps: 15, lane: 1, length_m: 4.6 },
    ],
    events: [{ at_s: 2, type: 'cut_in', vehicle_id: 'cutter', duration_s: 1 }],
    sensor_dropouts: [],
  },
  {
    id: 'stationary_obstacle',
    label: 'Stationary obstacle',
    duration_s: 12,
    seed: 606,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 16, lane: 0, length_m: 4.6 },
    traffic: [
      { id: 'obstacle', type: 'obstacle', position_m: 35, speed_mps: 0, lane: 0, length_m: 1.0 },
    ],
    events: [],
    sensor_dropouts: [],
  },
  {
    id: 'pedestrian_crossing',
    label: 'Pedestrian crossing',
    duration_s: 12,
    seed: 707,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 12, lane: 0, length_m: 4.6 },
    traffic: [],
    pedestrians: [
      { id: 'pedestrian', position_m: 40, lane: 1, width_m: 0.6, crossing: false },
    ],
    events: [
      {
        at_s: 1,
        type: 'pedestrian_appear',
        pedestrian_id: 'pedestrian',
        crossing_duration_s: 2,
      },
    ],
    sensor_dropouts: [],
  },
  {
    id: 'free_road',
    label: 'Free road control case',
    duration_s: 12,
    seed: 101,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 15, lane: 0, length_m: 4.6 },
    traffic: [],
    events: [],
    sensor_dropouts: [],
  },
]);

export function validateUpdatePackage(value: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isPlainObject(value)) return { valid: false, errors: ['package: expected a JSON object'] };
  for (const key of ['package_id', 'version', 'params']) {
    if (!(key in value)) errors.push(`${key}: required field is missing`);
  }
  for (const key of Object.keys(value)) {
    if (!['package_id', 'version', 'params'].includes(key)) {
      errors.push(`${key}: unknown package field`);
    }
  }
  if (
    'package_id' in value &&
    (typeof value.package_id !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(value.package_id))
  ) {
    errors.push(
      'package_id: expected 2-64 letters, digits, dot, underscore, or hyphen characters'
    );
  }
  if (
    'version' in value &&
    (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.version))
  ) {
    errors.push('version: expected semantic version X.Y.Z');
  }
  if ('params' in value) {
    if (!isPlainObject(value.params)) {
      errors.push('params: expected an object');
    } else {
      for (const key of Object.keys(value.params)) {
        if (!REQUIRED_PARAM_KEYS.includes(key as keyof AdasPackageParams)) {
          errors.push(`params.${key}: unknown parameter`);
        }
      }
      for (const key of REQUIRED_PARAM_KEYS) {
        if (!(key in value.params)) {
          errors.push(`params.${key}: required field is missing`);
        } else if (key === 'fault_response') {
          if (
            typeof value.params[key] !== 'string' ||
            !FAULT_RESPONSES.has(value.params[key])
          ) {
            errors.push(
              `params.${key}: expected one of ${[...FAULT_RESPONSES].join(', ')}`
            );
          }
        } else {
          const n = value.params[key];
          const [min, max] = PARAMETER_BOUNDS[key];
          if (typeof n !== 'number' || !Number.isFinite(n)) {
            errors.push(`params.${key}: expected a finite JSON number`);
          } else if (n < min || n > max) {
            errors.push(`params.${key}: expected a value from ${min} to ${max}`);
          }
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function parseUpdatePackageJson(text: string): AdasUpdatePackage {
  let value: any;
  try {
    value = JSON.parse(text);
  } catch (error: any) {
    throw new SyntaxError(`Update package JSON is malformed: ${error.message}`);
  }
  const result = validateUpdatePackage(value);
  if (!result.valid) {
    throw new TypeError(`Invalid update package: ${result.errors.join('; ')}`);
  }
  return value as AdasUpdatePackage;
}

export function controllerCommand({
  params: p,
  ego,
  measurement,
  sensorInvalidForS,
  lastValidMeasurement,
}: {
  params: AdasPackageParams;
  ego: { speedMps: number };
  measurement: {
    valid: boolean;
    gapM: number | null;
    speedMps: number | null;
    targetId: string | null;
    held: boolean;
  };
  sensorInvalidForS: number;
  lastValidMeasurement: {
    valid: boolean;
    gapM: number | null;
    speedMps: number | null;
    targetId: string | null;
    held: boolean;
  } | null;
}) {
  const faultActive = sensorInvalidForS >= p.fault_timeout_s;
  const sensorFault = !measurement.valid && faultActive;
  if (!measurement.valid && faultActive) {
    if (p.fault_response === 'brake_gently') {
      return {
        targetAccelMps2: -Math.min(p.comfort_decel_mps2, 1.5),
        mode: 'SENSOR_FAULT_BRAKE',
        aeb: false,
        sensorFault: true,
        ttcS: null as number | null,
      };
    }
    if (p.fault_response === 'disengage') {
      return {
        targetAccelMps2: 0,
        mode: 'SENSOR_FAULT_DISENGAGE',
        aeb: false,
        sensorFault: true,
        ttcS: null as number | null,
      };
    }
    if (!lastValidMeasurement) {
      return {
        targetAccelMps2: -Math.min(p.comfort_decel_mps2, 1.5),
        mode: 'SENSOR_FAULT_BRAKE',
        aeb: false,
        sensorFault: true,
        ttcS: null as number | null,
      };
    }
    measurement = { ...lastValidMeasurement, valid: true, held: true };
  }

  if (measurement.valid && measurement.gapM === null) {
    return {
      targetAccelMps2: 0,
      mode: 'ACC_NO_TARGET',
      aeb: false,
      sensorFault: false,
      ttcS: null as number | null,
    };
  }
  const usable = measurement.valid || measurement.held === true;
  if (!usable || measurement.gapM === null || measurement.speedMps === null) {
    return {
      targetAccelMps2: 0,
      mode: 'SENSOR_INVALID_WAIT',
      aeb: false,
      sensorFault: false,
      ttcS: null as number | null,
    };
  }
  const closingSpeed = ego.speedMps - measurement.speedMps;
  const ttcS = closingSpeed > 0 ? Math.max(0, measurement.gapM / closingSpeed) : null;
  if (ttcS !== null && ttcS <= p.aeb_ttc_s) {
    return {
      targetAccelMps2: -p.aeb_decel_mps2,
      mode: 'AEB',
      aeb: true,
      sensorFault: sensorFault || !measurement.valid,
      ttcS,
    };
  }
  const desiredGap = p.standstill_gap_m + p.time_headway_s * ego.speedMps;
  const targetAccelMps2 = clamp(
    0.35 * (measurement.gapM - desiredGap) + 0.8 * (measurement.speedMps - ego.speedMps),
    -p.comfort_decel_mps2,
    p.max_accel_mps2
  );
  return {
    targetAccelMps2,
    mode: measurement.held ? 'ACC_HOLD' : 'ACC',
    aeb: false,
    sensorFault: sensorFault || !measurement.valid,
    ttcS,
  };
}

export function runSimulation({
  scenario,
  updatePackage,
}: {
  scenario: AdasScenario;
  updatePackage: AdasUpdatePackage;
}): AdasSimulationResult {
  const val = validateUpdatePackage(updatePackage);
  if (!val.valid) {
    throw new TypeError(`Invalid update package: ${val.errors.join('; ')}`);
  }
  const params = updatePackage.params;
  const seed = scenario.seed;
  const durationS = scenario.duration_s;
  const rng = makeRng(seed);

  const ego = {
    ...scenario.ego,
    accelerationMps2: 0,
    stopped: false,
    collision: false,
  };
  const startedMoving = ego.speed_mps > 0;
  const traffic = scenario.traffic.map((v) => ({
    ...v,
    accelerationMps2: 0,
    stopped: v.speed_mps === 0,
    collision: false,
    brakeMps2: 0,
    cutIn: undefined as
      | { start_s: number; end_s: number; fromLane: number; toLane: number }
      | undefined,
  }));
  const pedestrians = (scenario.pedestrians || []).map((p) => ({
    ...p,
    active: false,
    initialLane: p.lane,
    collision: false,
    crossingStartS: 0,
    crossingEndS: 0,
    speedMps: 0,
  }));

  const fired = new Set<number>();
  const eventLog: AdasSimulationResult['events'] = [];
  const trace: AdasTraceFrame[] = [];
  const eventState = { aeb: false, sensorFault: false };
  let lastValidMeasurement: {
    valid: boolean;
    gapM: number | null;
    speedMps: number | null;
    targetId: string | null;
    held: boolean;
  } | null = null;
  let sensorInvalidForS = 0;
  let minGapM: number | null = null;
  let minValidTtcS: number | null = null;
  let peakDecelerationMps2 = 0;
  let timeInAebS = 0;
  let collision = false;
  let impactSpeedMps: number | null = null;
  let stoppedSafely = false;
  const stepCount = Math.round(durationS / FIXED_DT_S);

  for (let tick = 0; tick <= stepCount; tick++) {
    const timeS = round(tick * FIXED_DT_S, 8);
    applyTrafficEvents(scenario, timeS, fired, traffic, pedestrians, eventLog);
    advancePedestrians(pedestrians, timeS);

    const target = nearestTarget(ego, traffic, pedestrians, false);
    const inDropout = scenario.sensor_dropouts.some(
      (w) => timeS >= w.start_s && timeS < w.end_s
    );
    let measurement: {
      valid: boolean;
      gapM: number | null;
      speedMps: number | null;
      targetId: string | null;
      held: boolean;
    } = {
      valid: !inDropout,
      gapM: null,
      speedMps: null,
      targetId: null,
      held: false,
    };

    if (!inDropout && target && target.gapM <= params.sensor_detection_range_m) {
      const noisyGap = Math.max(
        0,
        target.gapM + gaussianNoise(rng) * params.sensor_noise_std_m
      );
      measurement = {
        valid: true,
        gapM: noisyGap,
        speedMps: target.speedMps,
        targetId: target.id,
        held: false,
      };
      lastValidMeasurement = { ...measurement };
    }
    if (measurement.valid) sensorInvalidForS = 0;

    const collisionTarget = nearestTarget(ego, traffic, pedestrians, true);
    if (collisionTarget) {
      collision = true;
      ego.collision = true;
      if (collisionTarget.vehicle) collisionTarget.vehicle.collision = true;
      impactSpeedMps = Math.abs(ego.speed_mps - collisionTarget.speedMps);
      eventLog.push({
        t_s: timeS,
        type: 'COLLISION',
        target_id: collisionTarget.id,
        impact_speed_mps: round(impactSpeedMps, 6),
      });
    }

    const command = controllerCommand({
      params,
      ego: { speedMps: ego.speed_mps },
      measurement,
      sensorInvalidForS,
      lastValidMeasurement,
    });
    if (!measurement.valid && tick < stepCount) {
      sensorInvalidForS = round(sensorInvalidForS + FIXED_DT_S, 8);
    }
    updateEvent(eventState, 'sensorFault', command.sensorFault, 'SENSOR_FAULT', timeS, eventLog);
    updateEvent(eventState, 'aeb', command.aeb, 'AEB_ACTIVE', timeS, eventLog);
    if (command.aeb && tick < stepCount) timeInAebS += FIXED_DT_S;

    const metricTarget = collisionTarget || target;
    if (metricTarget) {
      minGapM = minGapM === null ? metricTarget.gapM : Math.min(minGapM, metricTarget.gapM);
    }
    if (measurement.valid && command.ttcS !== null && command.ttcS !== undefined) {
      minValidTtcS =
        minValidTtcS === null ? command.ttcS : Math.min(minValidTtcS, command.ttcS);
    }

    const thisMeasurement = measurement.valid ? measurement : null;
    if (
      !collision &&
      startedMoving &&
      ego.speed_mps <= 0.05 &&
      thisMeasurement &&
      thisMeasurement.gapM !== null &&
      thisMeasurement.gapM > 0
    ) {
      if (!stoppedSafely) eventLog.push({ t_s: timeS, type: 'STOPPED_SAFELY' });
      stoppedSafely = true;
    }

    const visibleTarget = target || collisionTarget;
    trace.push({
      t_s: timeS,
      ego: {
        position_m: round(ego.position_m, 6),
        speed_mps: round(ego.speed_mps, 6),
        acceleration_mps2: round(ego.accelerationMps2, 6),
        lane: round(ego.lane, 6),
        stopped: ego.stopped,
        collision: ego.collision,
      },
      traffic_state: traffic.map((v) => ({
        id: v.id,
        type: v.type,
        position_m: round(v.position_m, 6),
        speed_mps: round(v.speed_mps, 6),
        lane: round(v.lane, 6),
        length_m: v.length_m,
        braking: v.brakeMps2 > 0,
      })),
      pedestrians_state: pedestrians.map((p) => ({
        id: p.id,
        position_m: round(p.position_m, 6),
        lane: round(p.lane, 6),
        width_m: p.width_m,
        active: p.active,
        crossing: p.crossing,
      })),
      ground_truth_target: visibleTarget
        ? {
            id: visibleTarget.id,
            type: visibleTarget.pedestrian
              ? 'pedestrian'
              : visibleTarget.vehicle?.type || 'car',
            gap_m: round(visibleTarget.gapM, 6),
            speed_mps: round(visibleTarget.speedMps, 6),
            position_m: round(
              visibleTarget.vehicle?.position_m ??
                visibleTarget.pedestrian?.position_m ??
                0,
              6
            ),
            lane: round(
              visibleTarget.vehicle?.lane ?? visibleTarget.pedestrian?.lane ?? 0,
              6
            ),
          }
        : null,
      sensor: {
        valid: measurement.valid,
        held: Boolean(measurement.held),
        gap_m: measurement.gapM === null ? null : round(measurement.gapM, 6),
        target_id: measurement.targetId,
      },
      controller: {
        mode: command.mode,
        target_accel_mps2: round(command.targetAccelMps2, 6),
        aeb: command.aeb,
        ttc_s: command.ttcS == null ? null : round(command.ttcS, 6),
      },
      friction_limit_mps2: round(scenario.friction * GRAVITY_MPS2, 6),
    });

    if (collision || stoppedSafely || tick === stepCount) break;

    const frictionLimit = scenario.friction * GRAVITY_MPS2;
    const emergency = command.aeb;
    const physicalTarget = clamp(
      command.targetAccelMps2,
      -frictionLimit,
      params.max_accel_mps2
    );
    let acceleration = physicalTarget;
    if (!emergency) {
      const maxDelta = params.max_jerk_mps3 * FIXED_DT_S;
      acceleration = clamp(
        physicalTarget,
        ego.accelerationMps2 - maxDelta,
        ego.accelerationMps2 + maxDelta
      );
      acceleration = clamp(acceleration, -frictionLimit, params.max_accel_mps2);
    }
    const oldSpeed = ego.speed_mps;
    const newSpeed = Math.max(0, oldSpeed + acceleration * FIXED_DT_S);
    const realizedAcceleration = (newSpeed - oldSpeed) / FIXED_DT_S;
    ego.position_m += (oldSpeed + newSpeed) * 0.5 * FIXED_DT_S;
    ego.speed_mps = newSpeed;
    ego.accelerationMps2 = realizedAcceleration;
    ego.stopped = newSpeed <= 1e-9;
    peakDecelerationMps2 = Math.max(
      peakDecelerationMps2,
      Math.max(0, -realizedAcceleration)
    );
    advanceTraffic(traffic, FIXED_DT_S, scenario.friction, timeS);
  }

  const metrics: AdasRunMetrics = {
    min_gap_m: finiteOrNull(minGapM),
    min_valid_ttc_s: finiteOrNull(minValidTtcS),
    peak_deceleration_mps2: round(peakDecelerationMps2, 6),
    time_in_aeb_s: round(timeInAebS, 6),
    collision,
    collision_time_s: collision ? trace[trace.length - 1].t_s : null,
    impact_speed_mps: finiteOrNull(impactSpeedMps),
    stopped_safely: stoppedSafely,
    ended_by: collision
      ? 'collision'
      : stoppedSafely
      ? 'stopped_safely'
      : 'simulation_timeout',
  };

  return {
    scenario_id: scenario.id,
    package_id: updatePackage.package_id,
    package_version: updatePackage.version,
    package_params: { ...params },
    scenario_input: JSON.parse(JSON.stringify(scenario)),
    run_config: {
      dt_s: FIXED_DT_S,
      seed,
      friction: scenario.friction,
      duration_s: durationS,
    },
    metrics,
    events: eventLog,
    trace,
  };
}

export function compareResults(
  baseline: AdasSimulationResult,
  candidate: AdasSimulationResult
): AdasComparisonSummary {
  const a = baseline.metrics;
  const b = candidate.metrics;
  const evidence = {
    collision_introduced: !a.collision && b.collision,
    impact_speed_increased_mps:
      b.collision && a.collision && b.impact_speed_mps !== null && a.impact_speed_mps !== null
        ? round(b.impact_speed_mps - a.impact_speed_mps, 6)
        : null,
    minimum_gap_decreased_m:
      a.min_gap_m !== null && b.min_gap_m !== null
        ? round(b.min_gap_m - a.min_gap_m, 6)
        : null,
    minimum_ttc_decreased_s:
      a.min_valid_ttc_s !== null && b.min_valid_ttc_s !== null
        ? round(b.min_valid_ttc_s - a.min_valid_ttc_s, 6)
        : null,
    safe_stop_lost: a.stopped_safely && !b.stopped_safely,
  };

  const v2Worse =
    evidence.collision_introduced ||
    evidence.safe_stop_lost ||
    (evidence.impact_speed_increased_mps !== null &&
      evidence.impact_speed_increased_mps > 0) ||
    (evidence.minimum_gap_decreased_m !== null &&
      evidence.minimum_gap_decreased_m < -1e-6) ||
    (evidence.minimum_ttc_decreased_s !== null &&
      evidence.minimum_ttc_decreased_s < -1e-6);

  const paramDiffs: AdasComparisonSummary['parameter_differences'] = [];
  for (const key of Object.keys(baseline.package_params) as Array<
    keyof AdasPackageParams
  >) {
    if (baseline.package_params[key] !== candidate.package_params[key]) {
      paramDiffs.push({
        field: key,
        v1_value: baseline.package_params[key],
        v2_value: candidate.package_params[key],
      });
    }
  }

  return {
    scenario_id: baseline.scenario_id,
    baseline_package: `${baseline.package_id}@${baseline.package_version}`,
    candidate_package: `${candidate.package_id}@${candidate.package_version}`,
    parameter_differences: paramDiffs,
    v2_worse_on_safety: v2Worse,
    evidence,
  };
}

export function executeComparisonScenario(
  scenario: AdasScenario,
  baselinePkg: AdasUpdatePackage,
  candidatePkg: AdasUpdatePackage
): AdasComparisonRun {
  const baseline = runSimulation({ scenario, updatePackage: baselinePkg });
  const candidate = runSimulation({ scenario, updatePackage: candidatePkg });
  const comparison = compareResults(baseline, candidate);
  const durationS = Math.max(
    baseline.trace[baseline.trace.length - 1].t_s,
    candidate.trace[candidate.trace.length - 1].t_s
  );
  return {
    scenario,
    baseline,
    candidate,
    comparison,
    durationS,
  };
}

export function sampleTraceAt(
  result: AdasSimulationResult,
  timeS: number
): AdasTraceFrame {
  const trace = result.trace;
  if (trace.length === 0) {
    throw new Error('Empty trace');
  }
  const last = trace[trace.length - 1];
  if (timeS >= last.t_s) return last;
  const cursor = timeS / result.run_config.dt_s;
  const index = Math.min(trace.length - 2, Math.max(0, Math.floor(cursor)));
  const alpha = Math.min(1, Math.max(0, cursor - index));
  const a = trace[index];
  const b = trace[index + 1] || a;

  return {
    ...a,
    t_s: mix(a.t_s, b.t_s, alpha),
    ego: {
      position_m: mix(a.ego.position_m, b.ego.position_m, alpha),
      speed_mps: mix(a.ego.speed_mps, b.ego.speed_mps, alpha),
      acceleration_mps2: mix(a.ego.acceleration_mps2, b.ego.acceleration_mps2, alpha),
      lane: mix(a.ego.lane, b.ego.lane, alpha),
      stopped: alpha < 0.5 ? a.ego.stopped : b.ego.stopped,
      collision: a.ego.collision || b.ego.collision,
    },
    traffic_state: a.traffic_state.map((v) => {
      const next = b.traffic_state.find((item) => item.id === v.id);
      return next
        ? {
            ...v,
            position_m: mix(v.position_m, next.position_m, alpha),
            speed_mps: mix(v.speed_mps, next.speed_mps, alpha),
            lane: mix(v.lane, next.lane, alpha),
            braking: next.braking,
          }
        : v;
    }),
    pedestrians_state: a.pedestrians_state.map((p) => {
      const next = b.pedestrians_state.find((item) => item.id === p.id);
      return next
        ? {
            ...p,
            position_m: mix(p.position_m, next.position_m, alpha),
            lane: mix(p.lane, next.lane, alpha),
            active: next.active,
            crossing: next.crossing,
          }
        : p;
    }),
    ground_truth_target: a.ground_truth_target
      ? {
          ...a.ground_truth_target,
          gap_m: mix(
            a.ground_truth_target.gap_m,
            b.ground_truth_target?.gap_m ?? a.ground_truth_target.gap_m,
            alpha
          ),
          speed_mps: mix(
            a.ground_truth_target.speed_mps,
            b.ground_truth_target?.speed_mps ?? a.ground_truth_target.speed_mps,
            alpha
          ),
          position_m: mix(
            a.ground_truth_target.position_m,
            b.ground_truth_target?.position_m ?? a.ground_truth_target.position_m,
            alpha
          ),
          lane: mix(
            a.ground_truth_target.lane,
            b.ground_truth_target?.lane ?? a.ground_truth_target.lane,
            alpha
          ),
        }
      : null,
  };
}

export function buildExportArtifacts(
  baseline: AdasSimulationResult,
  candidate: AdasSimulationResult,
  generatedAt = new Date().toISOString()
) {
  const comparison = compareResults(baseline, candidate);
  const exportMetadata = {
    generated_at_utc: new Date(generatedAt).toISOString(),
    time_basis: 'wall_clock',
  };
  const results = {
    schema_version: EXPORT_SCHEMA_VERSION,
    export_metadata: exportMetadata,
    scenario: {
      id: baseline.scenario_id,
      seed: baseline.run_config.seed,
      inputs: baseline.scenario_input,
    },
    run_configuration: { ...baseline.run_config },
    runs: {
      baseline: {
        package: { package_id: baseline.package_id, version: baseline.package_version },
        params: baseline.package_params,
        run_configuration: baseline.run_config,
        metrics: baseline.metrics,
        events: baseline.events,
        trace: baseline.trace,
      },
      candidate: {
        package: { package_id: candidate.package_id, version: candidate.package_version },
        params: candidate.package_params,
        run_configuration: candidate.run_config,
        metrics: candidate.metrics,
        events: candidate.events,
        trace: candidate.trace,
      },
    },
  };
  const diff = {
    schema_version: EXPORT_SCHEMA_VERSION,
    export_metadata: exportMetadata,
    scenario: {
      id: baseline.scenario_id,
      seed: baseline.run_config.seed,
      inputs: baseline.scenario_input,
    },
    run_configuration: { ...baseline.run_config },
    baseline_package: {
      package_id: baseline.package_id,
      version: baseline.package_version,
    },
    candidate_package: {
      package_id: candidate.package_id,
      version: candidate.package_version,
    },
    parameter_differences: comparison.parameter_differences,
    v2_worse_on_safety: comparison.v2_worse_on_safety,
    evidence: comparison.evidence,
    metrics: { baseline: baseline.metrics, candidate: candidate.metrics },
  };
  return {
    results,
    diff,
    resultsJson: `${JSON.stringify(results, null, 2)}\n`,
    diffJson: `${JSON.stringify(diff, null, 2)}\n`,
  };
}

export function downloadJsonFile(filename: string, jsonText: string) {
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Internal helpers
function applyTrafficEvents(
  scenario: AdasScenario,
  t: number,
  fired: Set<number>,
  traffic: Array<
    AdasTrafficActor & {
      brakeMps2: number;
      cutIn?: { start_s: number; end_s: number; fromLane: number; toLane: number };
    }
  >,
  pedestrians: Array<
    AdasPedestrianActor & {
      active: boolean;
      crossingStartS: number;
      crossingEndS: number;
    }
  >,
  events: AdasSimulationResult['events']
) {
  for (let i = 0; i < scenario.events.length; i++) {
    const e = scenario.events[i];
    if (!fired.has(i) && Math.abs(e.at_s - t) < 1e-8) {
      fired.add(i);
      if (e.type === 'lead_brake') {
        const v = traffic.find((item) => item.id === e.vehicle_id);
        if (v && e.decel_mps2 !== undefined) v.brakeMps2 = e.decel_mps2;
      } else if (e.type === 'cut_in') {
        const v = traffic.find((item) => item.id === e.vehicle_id);
        if (v && e.duration_s !== undefined) {
          v.cutIn = {
            start_s: e.at_s,
            end_s: e.at_s + e.duration_s,
            fromLane: v.lane,
            toLane: 0,
          };
        }
      } else if (e.type === 'pedestrian_appear') {
        const p = pedestrians.find((item) => item.id === e.pedestrian_id);
        if (p && e.crossing_duration_s !== undefined) {
          p.active = true;
          p.crossingStartS = e.at_s;
          p.crossingEndS = e.at_s + e.crossing_duration_s;
        }
      }
      events.push({
        t_s: t,
        type: 'SCENARIO_EVENT',
        event_type: e.type,
        target_id: e.vehicle_id || e.pedestrian_id || null,
      });
    }
  }
}

function advanceTraffic(
  traffic: Array<
    AdasTrafficActor & {
      brakeMps2: number;
      stopped: boolean;
      cutIn?: { start_s: number; end_s: number; fromLane: number; toLane: number };
    }
  >,
  dt: number,
  mu: number,
  timeS: number
) {
  const limit = mu * GRAVITY_MPS2;
  for (const v of traffic) {
    if (v.cutIn) {
      const f = clamp(
        (timeS - v.cutIn.start_s) / (v.cutIn.end_s - v.cutIn.start_s),
        0,
        1
      );
      v.lane = v.cutIn.fromLane + (v.cutIn.toLane - v.cutIn.fromLane) * f;
    }
    const a = -Math.min(v.brakeMps2, limit);
    const next = Math.max(0, v.speed_mps + a * dt);
    v.position_m += (v.speed_mps + next) * 0.5 * dt;
    v.speed_mps = next;
    v.stopped = next <= 1e-9;
  }
}

function advancePedestrians(
  pedestrians: Array<
    AdasPedestrianActor & {
      active: boolean;
      initialLane: number;
      crossingStartS: number;
      crossingEndS: number;
      speedMps: number;
    }
  >,
  t: number
) {
  for (const p of pedestrians) {
    if (!p.active) continue;
    const f = clamp(
      (t - p.crossingStartS) / (p.crossingEndS - p.crossingStartS),
      0,
      1
    );
    p.lane = p.initialLane + (0 - p.initialLane) * f;
    p.crossing = t <= p.crossingEndS && f < 1;
    p.speedMps = 0;
  }
}

function nearestTarget(
  ego: { position_m: number; lane: number; length_m: number },
  traffic: Array<AdasTrafficActor & { collision?: boolean }>,
  pedestrians: Array<AdasPedestrianActor & { active: boolean }>,
  collisionOnly = false
) {
  const candidates: Array<{
    id: string;
    gapM: number;
    speedMps: number;
    lengthM: number;
    vehicle?: AdasTrafficActor & { collision?: boolean };
    pedestrian?: AdasPedestrianActor & { active: boolean };
  }> = [];

  for (const v of traffic) {
    if (Math.abs(v.lane - ego.lane) > 0.5) continue;
    const gapM = v.position_m - v.length_m / 2 - (ego.position_m + ego.length_m / 2);
    const overlaps = gapM <= 0 && gapM > -(ego.length_m + v.length_m);
    if (collisionOnly ? overlaps : gapM >= 0) {
      candidates.push({
        id: v.id,
        gapM,
        speedMps: v.speed_mps,
        lengthM: v.length_m,
        vehicle: v,
      });
    }
  }
  for (const p of pedestrians) {
    if (!p.active || !p.crossing || Math.abs(p.lane - ego.lane) > 0.5) continue;
    const gapM = p.position_m - p.width_m / 2 - (ego.position_m + ego.length_m / 2);
    const overlaps = gapM <= 0 && gapM > -(ego.length_m + p.width_m);
    if (collisionOnly ? overlaps : gapM >= 0) {
      candidates.push({
        id: p.id,
        gapM,
        speedMps: 0,
        lengthM: p.width_m,
        pedestrian: p,
      });
    }
  }
  candidates.sort((a, b) => a.gapM - b.gapM || a.id.localeCompare(b.id));
  return candidates[0] || null;
}

function updateEvent(
  state: { aeb: boolean; sensorFault: boolean },
  key: 'aeb' | 'sensorFault',
  active: boolean,
  type: string,
  t: number,
  events: AdasSimulationResult['events']
) {
  if (active && !state[key]) events.push({ t_s: t, type });
  if (!active && state[key]) events.push({ t_s: t, type: `${type}_CLEARED` });
  state[key] = active;
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function gaussianNoise(rng: () => number) {
  const u1 = Math.max(Number.EPSILON, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(x: number, min: number, max: number) {
  return Math.min(max, Math.max(min, x));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function finiteOrNull(x: number | null) {
  return x === null || !Number.isFinite(x) ? null : round(x, 6);
}

function round(x: number, places: number) {
  const scale = 10 ** places;
  return Math.round((x + Number.EPSILON) * scale) / scale;
}

function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
