export const SCENARIOS = Object.freeze([
  {
    id: 'free_road', label: 'Free road control case', duration_s: 12, seed: 101,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 15, lane: 0, length_m: 4.6 },
    traffic: [], events: [], sensor_dropouts: [],
  },
  {
    id: 'lead_brake', label: 'Lead vehicle hard braking', duration_s: 12, seed: 202,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 22, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'lead', type: 'car', position_m: 32.6, speed_mps: 18, lane: 0, length_m: 4.6 }],
    events: [{ at_s: 2, type: 'lead_brake', vehicle_id: 'lead', decel_mps2: 6 }], sensor_dropouts: [],
  },
  {
    id: 'wet_lead_brake', label: 'Wet road lead braking', duration_s: 12, seed: 303,
    friction: 0.4,
    ego: { position_m: 0, speed_mps: 20, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'lead', type: 'car', position_m: 28.6, speed_mps: 16, lane: 0, length_m: 4.6 }],
    events: [{ at_s: 1.5, type: 'lead_brake', vehicle_id: 'lead', decel_mps2: 6 }], sensor_dropouts: [],
  },
  {
    id: 'sensor_dropout', label: 'Sensor dropout during lead braking', duration_s: 12, seed: 404,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 20, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'lead', type: 'car', position_m: 27.6, speed_mps: 15, lane: 0, length_m: 4.6 }],
    events: [{ at_s: 1, type: 'lead_brake', vehicle_id: 'lead', decel_mps2: 5 }],
    sensor_dropouts: [{ start_s: 2, end_s: 3.2 }],
  },
  {
    id: 'cut_in', label: 'Adjacent vehicle cut-in', duration_s: 12, seed: 505,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 18, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'cutter', type: 'car', position_m: 23, speed_mps: 15, lane: 1, length_m: 4.6 }],
    events: [{ at_s: 2, type: 'cut_in', vehicle_id: 'cutter', duration_s: 1 }], sensor_dropouts: [],
  },
  {
    id: 'stationary_obstacle', label: 'Stationary obstacle', duration_s: 12, seed: 606,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 16, lane: 0, length_m: 4.6 },
    traffic: [{ id: 'obstacle', type: 'obstacle', position_m: 35, speed_mps: 0, lane: 0, length_m: 1.0 }],
    events: [], sensor_dropouts: [],
  },
  {
    id: 'pedestrian_crossing', label: 'Pedestrian crossing', duration_s: 12, seed: 707,
    friction: 0.9,
    ego: { position_m: 0, speed_mps: 12, lane: 0, length_m: 4.6 },
    traffic: [],
    pedestrians: [{ id: 'pedestrian', position_m: 40, lane: 1, width_m: 0.6, crossing: false }],
    events: [{ at_s: 1, type: 'pedestrian_appear', pedestrian_id: 'pedestrian', crossing_duration_s: 2 }], sensor_dropouts: [],
  },
]);

export function validateScenario(scenario) {
  const errors = [];
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) return ['scenario: expected an object'];
  const allowed = new Set(['id', 'label', 'duration_s', 'seed', 'friction', 'ego', 'traffic', 'events', 'sensor_dropouts', 'pedestrians']);
  for (const key of Object.keys(scenario)) if (!allowed.has(key)) errors.push(`${key}: unknown scenario field`);
  for (const key of ['id', 'duration_s', 'seed', 'friction', 'ego', 'traffic', 'events', 'sensor_dropouts']) {
    if (!(key in scenario)) errors.push(`${key}: required field is missing`);
  }
  if (typeof scenario.id !== 'string' || !scenario.id) errors.push('id: expected a non-empty string');
  if (!finiteIn(scenario.duration_s, 0.02, 120) || Math.abs(scenario.duration_s / 0.02 - Math.round(scenario.duration_s / 0.02)) > 1e-8) errors.push('duration_s: expected a finite 0.02-second-step-aligned duration from 0.02 to 120 seconds');
  if (!Number.isSafeInteger(scenario.seed) || scenario.seed < 0 || scenario.seed > 0xffffffff) errors.push('seed: expected an unsigned 32-bit integer');
  if (!finiteIn(scenario.friction, 0.05, 1.5)) errors.push('friction: expected a finite coefficient from 0.05 to 1.5');
  if (!scenario.ego || !validVehicle(scenario.ego)) errors.push('ego: requires finite position_m, nonnegative speed_mps, lane, and positive length_m');
  if (scenario.ego && Object.keys(scenario.ego).some(k => !['position_m', 'speed_mps', 'lane', 'length_m'].includes(k))) errors.push('ego: unknown vehicle field');
  if (!Array.isArray(scenario.traffic) || scenario.traffic.some(v => !validVehicle(v) || typeof v.id !== 'string' || !['car', 'obstacle'].includes(v.type))) errors.push('traffic: expected car/obstacle entries with unique string IDs and valid dimensions/state');
  if (Array.isArray(scenario.traffic) && scenario.traffic.some(v => v && Object.keys(v).some(k => !['id', 'type', 'position_m', 'speed_mps', 'lane', 'length_m'].includes(k)))) errors.push('traffic: unknown vehicle field');
  if (Array.isArray(scenario.traffic) && new Set(scenario.traffic.map(v => v?.id)).size !== scenario.traffic.length) errors.push('traffic: vehicle IDs must be unique');
  if (!Array.isArray(scenario.events)) errors.push('events: expected an array');
  else for (const [i, event] of scenario.events.entries()) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) { errors.push(`events[${i}]: expected an object`); continue; }
    if (!Number.isFinite(event.at_s) || event.at_s < 0 || event.at_s > scenario.duration_s) errors.push(`events[${i}].at_s: must be within the simulation duration`);
    else if (Math.abs(event.at_s / 0.02 - Math.round(event.at_s / 0.02)) > 1e-8) errors.push(`events[${i}].at_s: must align to the 0.02-second simulation step`);
    if (!['lead_brake', 'cut_in', 'pedestrian_appear'].includes(event.type)) errors.push(`events[${i}].type: unsupported event type`);
    if (event.type === 'lead_brake' && (!(Array.isArray(scenario.traffic) && scenario.traffic.some(v => v?.id === event.vehicle_id)) || !finiteIn(event.decel_mps2, 0.1, 9.81))) errors.push(`events[${i}]: lead_brake requires an existing vehicle_id and decel_mps2 from 0.1 to 9.81`);
    if (event.type === 'cut_in' && (!(Array.isArray(scenario.traffic) && scenario.traffic.some(v => v?.id === event.vehicle_id)) || !finiteIn(event.duration_s, 0.02, 10) || Math.abs(event.duration_s / 0.02 - Math.round(event.duration_s / 0.02)) > 1e-8 || event.at_s + event.duration_s > scenario.duration_s)) errors.push(`events[${i}]: cut_in requires an existing vehicle_id and a step-aligned duration_s within the run`);
    if (event.type === 'pedestrian_appear' && (!(Array.isArray(scenario.pedestrians) && scenario.pedestrians.some(p => p?.id === event.pedestrian_id)) || !finiteIn(event.crossing_duration_s, 0.02, 10) || Math.abs(event.crossing_duration_s / 0.02 - Math.round(event.crossing_duration_s / 0.02)) > 1e-8 || event.at_s + event.crossing_duration_s > scenario.duration_s)) errors.push(`events[${i}]: pedestrian_appear requires an existing pedestrian_id and a step-aligned crossing duration within the run`);
    const eventAllowed = event.type === 'lead_brake' ? ['at_s', 'type', 'vehicle_id', 'decel_mps2'] : event.type === 'cut_in' ? ['at_s', 'type', 'vehicle_id', 'duration_s'] : ['at_s', 'type', 'pedestrian_id', 'crossing_duration_s'];
    if (Object.keys(event).some(k => !eventAllowed.includes(k))) errors.push(`events[${i}]: unknown field`);
  }
  if (!Array.isArray(scenario.sensor_dropouts)) errors.push('sensor_dropouts: expected an array');
  else for (const [i, interval] of scenario.sensor_dropouts.entries()) {
    if (!interval || typeof interval !== 'object' || Array.isArray(interval)) { errors.push(`sensor_dropouts[${i}]: expected an object`); continue; }
    if (!Number.isFinite(interval.start_s) || !Number.isFinite(interval.end_s) || interval.start_s < 0 || interval.end_s <= interval.start_s || interval.end_s > scenario.duration_s || Math.abs(interval.start_s / 0.02 - Math.round(interval.start_s / 0.02)) > 1e-8 || Math.abs(interval.end_s / 0.02 - Math.round(interval.end_s / 0.02)) > 1e-8) errors.push(`sensor_dropouts[${i}]: expected a valid 0.02-second-step-aligned interval within simulation duration`);
    if (Object.keys(interval).some(k => !['start_s', 'end_s'].includes(k))) errors.push(`sensor_dropouts[${i}]: unknown field`);
  }
  if (scenario.pedestrians !== undefined && (!Array.isArray(scenario.pedestrians) || scenario.pedestrians.some(p => !p || typeof p.id !== 'string' || !Number.isFinite(p.position_m) || !Number.isInteger(p.lane) || !finiteIn(p.width_m, 0.1, 3)))) errors.push('pedestrians: expected IDs, finite positions, integer lanes, and widths from 0.1 to 3 m');
  if (Array.isArray(scenario.pedestrians) && scenario.pedestrians.some(p => p && Object.keys(p).some(k => !['id', 'position_m', 'lane', 'width_m', 'crossing'].includes(k)))) errors.push('pedestrians: unknown pedestrian field');
  if (Array.isArray(scenario.pedestrians) && new Set(scenario.pedestrians.map(p => p?.id)).size !== scenario.pedestrians.length) errors.push('pedestrians: IDs must be unique');
  return errors;
}

function validVehicle(v) {
  return !!v && Number.isFinite(v.position_m) && finiteIn(v.speed_mps, 0, 80) && Number.isInteger(v.lane) && finiteIn(v.length_m, 0.2, 30);
}
function finiteIn(n, min, max) { return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max; }
