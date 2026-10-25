export const PARAMETER_BOUNDS = Object.freeze({
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
});

const REQUIRED = [...Object.keys(PARAMETER_BOUNDS), 'fault_response'];
const FAULT_RESPONSES = new Set(['brake_gently', 'hold_last_valid_reading', 'disengage']);

export function validateUpdatePackage(value) {
  const errors = [];
  if (!isPlainObject(value)) return { valid: false, errors: ['package: expected a JSON object'] };
  for (const key of ['package_id', 'version', 'params']) {
    if (!(key in value)) errors.push(`${key}: required field is missing`);
  }
  for (const key of Object.keys(value)) {
    if (!['package_id', 'version', 'params'].includes(key)) errors.push(`${key}: unknown package field`);
  }
  if ('package_id' in value && (typeof value.package_id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(value.package_id))) {
    errors.push('package_id: expected 2-64 letters, digits, dot, underscore, or hyphen characters');
  }
  if ('version' in value && (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.version))) {
    errors.push('version: expected semantic version X.Y.Z');
  }
  if ('params' in value) {
    if (!isPlainObject(value.params)) errors.push('params: expected an object');
    else {
      for (const key of Object.keys(value.params)) if (!REQUIRED.includes(key)) errors.push(`params.${key}: unknown parameter`);
      for (const key of REQUIRED) {
        if (!(key in value.params)) {
          errors.push(`params.${key}: required field is missing`);
        } else if (key === 'fault_response') {
          if (typeof value.params[key] !== 'string' || !FAULT_RESPONSES.has(value.params[key])) {
            errors.push(`params.${key}: expected one of ${[...FAULT_RESPONSES].join(', ')}`);
          }
        } else {
          const n = value.params[key];
          const [min, max] = PARAMETER_BOUNDS[key];
          if (typeof n !== 'number' || !Number.isFinite(n)) errors.push(`params.${key}: expected a finite JSON number`);
          else if (n < min || n > max) errors.push(`params.${key}: expected a value from ${min} to ${max}`);
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function parseUpdatePackageJson(text) {
  if (typeof text !== 'string') throw new TypeError('Update package: expected JSON text');
  let value;
  try { value = JSON.parse(text); }
  catch (error) { throw new SyntaxError(`Update package JSON is malformed: ${error.message}`); }
  return requireValidUpdatePackage(value);
}

export function requireValidUpdatePackage(value) {
  const result = validateUpdatePackage(value);
  if (!result.valid) throw new TypeError(`Invalid update package: ${result.errors.join('; ')}`);
  return value;
}

export function controllerCommand({ params: p, ego, measurement, sensorInvalidForS, lastValidMeasurement }) {
  const faultActive = sensorInvalidForS >= p.fault_timeout_s;
  const sensorFault = !measurement.valid && faultActive;
  if (!measurement.valid && faultActive) {
    if (p.fault_response === 'brake_gently') {
      return { targetAccelMps2: -Math.min(p.comfort_decel_mps2, 1.5), mode: 'SENSOR_FAULT_BRAKE', aeb: false, sensorFault: true };
    }
    if (p.fault_response === 'disengage') {
      return { targetAccelMps2: 0, mode: 'SENSOR_FAULT_DISENGAGE', aeb: false, sensorFault: true };
    }
    if (!lastValidMeasurement) {
      return { targetAccelMps2: -Math.min(p.comfort_decel_mps2, 1.5), mode: 'SENSOR_FAULT_BRAKE', aeb: false, sensorFault: true };
    }
    measurement = { ...lastValidMeasurement, valid: true, held: true };
  }

  if (measurement.valid && measurement.gapM === null) {
    return { targetAccelMps2: 0, mode: 'ACC_NO_TARGET', aeb: false, sensorFault: false, ttcS: null };
  }
  const usable = measurement.valid || measurement.held === true;
  if (!usable) return { targetAccelMps2: 0, mode: 'SENSOR_INVALID_WAIT', aeb: false, sensorFault: false, ttcS: null };
  const closingSpeed = ego.speedMps - measurement.speedMps;
  // Gap is bumper-to-bumper clearance; TTC is undefined unless closing speed is positive.
  const ttcS = closingSpeed > 0 ? Math.max(0, measurement.gapM / closingSpeed) : null;
  if (ttcS !== null && ttcS <= p.aeb_ttc_s) {
    // Emergency braking bypasses comfort and jerk limits, but not friction or configured emergency brake capacity.
    return { targetAccelMps2: -p.aeb_decel_mps2, mode: 'AEB', aeb: true, sensorFault: sensorFault || !measurement.valid, ttcS };
  }
  const desiredGap = p.standstill_gap_m + p.time_headway_s * ego.speedMps;
  const targetAccelMps2 = clamp(0.35 * (measurement.gapM - desiredGap) + 0.8 * (measurement.speedMps - ego.speedMps),
    -p.comfort_decel_mps2, p.max_accel_mps2);
    return { targetAccelMps2, mode: measurement.held ? 'ACC_HOLD' : 'ACC', aeb: false, sensorFault: sensorFault || !measurement.valid, ttcS };
}

export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
