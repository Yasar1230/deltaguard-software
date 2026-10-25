import { World3D } from './world3d.js';
import { SCENARIOS } from './scenarios.js';
import { runSimulation, compareResults } from './sim_core.js';
import { parseUpdatePackageJson } from './controller.js';
import { buildExportArtifacts } from './export.js';
import { downloadJsonFile } from './downloads.js';

const el = id => document.getElementById(id);
const canvas = el('world');
let world;
let baselinePackage = null;
let candidatePackage = null;
let comparisonRun = null;
let animationId = null;
let playbackTimeS = 0;
let previousWallTimeMs = 0;
let playbackState = 'READY';

for (const scenario of SCENARIOS) {
  const option = document.createElement('option');
  option.value = scenario.id;
  option.textContent = scenario.label;
  el('scenario-select').append(option);
}
el('scenario-select').value = SCENARIOS.some(s => s.id === 'lead_brake') ? 'lead_brake' : SCENARIOS[0].id;
el('scenario-select').addEventListener('change', () => { resetRun(); updateScenarioLabel(); renderIdle(); });
el('candidate-file').addEventListener('change', loadCandidateFile);
el('run-button').addEventListener('click', startOrReplay);
el('pause-button').addEventListener('click', togglePause);
el('reset-button').addEventListener('click', resetRun);
el('results-export-button').addEventListener('click', () => downloadExport('results'));
el('diff-export-button').addEventListener('click', () => downloadExport('diff'));

try {
  world = new World3D(canvas);
  updateScenarioLabel();
  renderIdle();
  await loadDefaultPackages();
} catch (error) {
  fail(`3D comparison could not start. Check WebGL and the pinned Three.js CDN. ${error.message}`);
}

async function loadDefaultPackages() {
  const [baselineResponse, candidateResponse] = await Promise.all([
    fetch('./updates/update_v1.json'), fetch('./updates/update_v2.json'),
  ]);
  if (!baselineResponse.ok || !candidateResponse.ok) throw new Error('Could not load the baseline and example candidate packages.');
  baselinePackage = parseUpdatePackageJson(await baselineResponse.text());
  candidatePackage = parseUpdatePackageJson(await candidateResponse.text());
  el('baseline-version').textContent = `v${baselinePackage.version}`;
  updateCandidateLabel();
  el('package-status').textContent = 'Example candidate loaded';
  el('package-status').className = 'package-status valid';
  el('run-button').disabled = false;
}

async function loadCandidateFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const loaded = parseUpdatePackageJson(await file.text());
    candidatePackage = loaded;
    updateCandidateLabel();
    el('package-status').textContent = `Valid: ${loaded.package_id}@${loaded.version}`;
    el('package-status').className = 'package-status valid';
    el('error-message').hidden = true;
    el('run-button').disabled = false;
    resetRun();
  } catch (error) {
    el('package-status').textContent = 'Package rejected';
    el('package-status').className = 'package-status invalid';
    showError(error.message);
    event.target.value = '';
  }
}

function updateScenarioLabel() {
  const scenario = currentScenario();
  el('scenario-title').textContent = scenario.label;
}
function updateCandidateLabel() {
  el('candidate-version').textContent = `v${candidatePackage.version}`;
}
function currentScenario() { return SCENARIOS.find(s => s.id === el('scenario-select').value) || SCENARIOS[0]; }

function renderIdle() {
  if (!world) return;
  const scenario = currentScenario();
  const lead = scenario.traffic[0];
  const gap = lead ? lead.position_m - lead.length_m / 2 - (scenario.ego.position_m + scenario.ego.length_m / 2) : null;
  const state = { ...scenario.ego, acceleration_mps2: 0, stopped: false, collision: false };
  const target = lead ? { id: lead.id, gap_m: gap, speed_mps: lead.speed_mps, braking: false } : null;
  const traffic = scenario.traffic.map(v => ({ ...v, braking: false }));
  const session = { frame: { ego: state, controller: { mode: 'READY' } }, target, traffic, originLane: scenario.ego.lane };
  world.renderComparison(session, session, 0.016);
  el('sim-clock').textContent = '00:00.00';
  el('run-state').textContent = 'READY';
  el('result-summary').textContent = 'Both controllers will run on the same scenario inputs.';
  el('comparison-details').hidden = true;
  setCardIdle('baseline'); setCardIdle('candidate');
  el('run-button').disabled = !baselinePackage || !candidatePackage;
  el('run-button').textContent = 'RUN COMPARISON';
  el('pause-button').disabled = true;
  el('pause-button').textContent = 'PAUSE';
  el('reset-button').disabled = true;
}

function setCardIdle(which) {
  const scenario = currentScenario();
  const speed = scenario.ego.speed_mps * 3.6;
  const target = scenario.traffic.filter(v => v.lane === scenario.ego.lane && v.position_m > scenario.ego.position_m)
    .sort((a, b) => a.position_m - b.position_m)[0];
  el(`${which}-speed`).textContent = speed.toFixed(0);
  if (target) {
    const gap = target.position_m - target.length_m / 2 - (scenario.ego.position_m + scenario.ego.length_m / 2);
    const closingSpeed = scenario.ego.speed_mps - target.speed_mps;
    el(`${which}-gap`).innerHTML = `${gap.toFixed(1)} <small>m</small>`;
    el(`${which}-ttc`).innerHTML = closingSpeed > 0 ? `${(gap / closingSpeed).toFixed(2)} <small>s</small>` : '-- <small>s</small>';
  } else {
    el(`${which}-gap`).innerHTML = '-- <small>m</small>';
    el(`${which}-ttc`).innerHTML = '-- <small>s</small>';
  }
  el(`${which}-mode`).textContent = 'READY';
  el(`${which}-mode`).classList.remove('is-aeb');
}

function startOrReplay() {
  if (playbackState === 'RUNNING') return;
  if (!comparisonRun || playbackState === 'COMPLETED') {
    try {
      el('run-state').textContent = 'VALIDATING';
      el('error-message').hidden = true;
      const scenario = currentScenario();
      const sharedScenario = structuredClone(scenario);
      const baselineResult = runSimulation({ scenario: structuredClone(sharedScenario), updatePackage: baselinePackage });
      const candidateResult = runSimulation({ scenario: structuredClone(sharedScenario), updatePackage: candidatePackage });
      const comparison = compareResults(baselineResult, candidateResult);
      comparisonRun = { scenario: sharedScenario, baseline: baselineResult, candidate: candidateResult, comparison,
        durationS: Math.max(baselineResult.trace.at(-1).t_s, candidateResult.trace.at(-1).t_s) };
      window.__DELTA_GUARD_DEBUG__ = comparisonRun;
    } catch (error) {
      fail(error.message);
      return;
    }
    playbackTimeS = 0;
  }
  playbackState = 'RUNNING';
  el('results-export-button').disabled = true;
  el('diff-export-button').disabled = true;
  el('export-status').textContent = 'Exports are available after playback completes.';
  el('run-state').textContent = 'RUNNING';
  el('run-button').disabled = true;
  el('run-button').textContent = 'RUNNING';
  el('pause-button').disabled = false;
  el('pause-button').textContent = 'PAUSE';
  el('reset-button').disabled = false;
  previousWallTimeMs = performance.now();
  animationId = requestAnimationFrame(renderPlayback);
}

function renderPlayback(now) {
  if (playbackState !== 'RUNNING' || !comparisonRun) return;
  const wallDeltaS = Math.min(0.1, Math.max(0, (now - previousWallTimeMs) / 1000));
  previousWallTimeMs = now;
  playbackTimeS = Math.min(comparisonRun.durationS, playbackTimeS + wallDeltaS * Number(el('speed-select').value));
  const baseline = sampleAt(comparisonRun.baseline, playbackTimeS, comparisonRun.scenario.ego.lane);
  const candidate = sampleAt(comparisonRun.candidate, playbackTimeS, comparisonRun.scenario.ego.lane);
  world.renderComparison(baseline, candidate, wallDeltaS);
  updateCard('baseline', baseline);
  updateCard('candidate', candidate);
  el('sim-clock').textContent = formatTime(playbackTimeS);
  if (playbackTimeS >= comparisonRun.durationS) {
    finishRun();
    return;
  }
  animationId = requestAnimationFrame(renderPlayback);
}

function sampleAt(result, timeS, originLane) {
  const trace = result.trace;
  if (timeS >= trace.at(-1).t_s) return frameFromSample(trace.at(-1), null, 0, originLane);
  const cursor = timeS / result.run_config.dt_s;
  const index = Math.min(trace.length - 2, Math.floor(cursor));
  const alpha = Math.min(1, cursor - index);
  return frameFromSample(trace[index], trace[index + 1], alpha, originLane);
}

function frameFromSample(a, b, alpha, originLane) {
  const ego = interpolate(a.ego, b?.ego ?? a.ego, alpha);
  const observed = a.ground_truth_target;
  const nextTarget = b?.ground_truth_target;
  const sameTarget = observed && nextTarget?.id === observed.id;
  const target = observed ? {
    ...observed,
    gap_m: mix(observed.gap_m, sameTarget ? nextTarget.gap_m : observed.gap_m, alpha),
    speed_mps: mix(observed.speed_mps, sameTarget ? nextTarget.speed_mps : observed.speed_mps, alpha),
    position_m: mix(observed.position_m, sameTarget ? nextTarget.position_m : observed.position_m, alpha),
    lane: mix(observed.lane, sameTarget ? nextTarget.lane : observed.lane, alpha),
    braking: Boolean(sameTarget && nextTarget.speed_mps < observed.speed_mps - 0.02),
  } : null;
  const nextTraffic = b?.traffic_state ?? [];
  const traffic = (a.traffic_state ?? []).map(vehicle => {
    const next = nextTraffic.find(item => item.id === vehicle.id);
    return next ? { ...vehicle, position_m: mix(vehicle.position_m, next.position_m, alpha),
      speed_mps: mix(vehicle.speed_mps, next.speed_mps, alpha), lane: mix(vehicle.lane, next.lane, alpha),
      braking: next.braking } : vehicle;
  });
  return { frame: { ego, controller: a.controller }, target, traffic, originLane };
}

function updateCard(which, session) {
  const sample = session.frame;
  el(`${which}-speed`).textContent = (sample.ego.speed_mps * 3.6).toFixed(0);
  const target = session.target;
  el(`${which}-gap`).innerHTML = target ? `${target.gap_m.toFixed(1)} <small>m</small>` : '-- <small>m</small>';
  const ttc = sample.controller.ttc_s;
  el(`${which}-ttc`).innerHTML = ttc == null ? '-- <small>s</small>' : `${ttc.toFixed(2)} <small>s</small>`;
  el(`${which}-mode`).textContent = sample.controller.mode;
  el(`${which}-mode`).classList.toggle('is-aeb', sample.controller.mode === 'AEB');
}

function togglePause() {
  if (playbackState === 'RUNNING') {
    playbackState = 'PAUSED';
    if (animationId !== null) cancelAnimationFrame(animationId);
    animationId = null;
    el('run-state').textContent = 'PAUSED';
    el('run-button').disabled = false;
    el('run-button').textContent = 'RESUME';
    el('pause-button').textContent = 'RESUME';
  } else if (playbackState === 'PAUSED') {
    playbackState = 'RUNNING';
    el('run-state').textContent = 'RUNNING';
    el('run-button').disabled = true;
    el('run-button').textContent = 'RUNNING';
    el('pause-button').textContent = 'PAUSE';
    previousWallTimeMs = performance.now();
    animationId = requestAnimationFrame(renderPlayback);
  }
}

function finishRun() {
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
  playbackState = 'COMPLETED';
  el('run-state').textContent = 'COMPLETED';
  el('run-button').disabled = false;
  el('run-button').textContent = 'REPLAY COMPARISON';
  el('pause-button').disabled = true;
  el('reset-button').disabled = false;
  renderFinalStates();
  showResults();
  try {
    comparisonRun.exports = buildExportArtifacts(comparisonRun.baseline, comparisonRun.candidate);
    el('results-export-button').disabled = false;
    el('diff-export-button').disabled = false;
    el('export-status').textContent = 'Validated exports are ready.';
  } catch (error) {
    el('export-status').textContent = 'Export validation failed.';
    showError(`Export failed: ${error.message}`);
  }
}

function downloadExport(kind) {
  if (playbackState !== 'COMPLETED' || !comparisonRun?.exports) return;
  try {
    downloadJsonFile(`${kind}.json`, kind === 'results' ? comparisonRun.exports.resultsJson : comparisonRun.exports.diffJson);
    el('export-status').textContent = `Downloaded ${kind}.json`;
  } catch (error) {
    showError(`Export failed: ${error.message}`);
  }
}

function renderFinalStates() {
  const scenario = comparisonRun.scenario;
  const lane = scenario.ego.lane;
  const finalSession = result => frameFromSample(result.trace.at(-1), null, 0, lane);
  world.renderComparison(finalSession(comparisonRun.baseline), finalSession(comparisonRun.candidate), 0.016);
  updateCard('baseline', finalSession(comparisonRun.baseline));
  updateCard('candidate', finalSession(comparisonRun.candidate));
  el('sim-clock').textContent = formatTime(comparisonRun.durationS);
}

function showResults() {
  const { baseline, candidate, comparison } = comparisonRun;
  const a = baseline.metrics, b = candidate.metrics;
  const decision = comparison.v2_worse_on_safety ? 'Candidate reduced one or more measured safety outcomes.' : 'No candidate-worse outcome was detected by the comparison rule.';
  el('result-summary').textContent = `Baseline: ${a.ended_by.replaceAll('_', ' ')} · candidate: ${b.ended_by.replaceAll('_', ' ')}.`;
  const diffs = comparison.parameter_differences;
  const changes = diffs.length ? diffs.map(d => `${d.field} ${d.v1_value} → ${d.v2_value}`).join(' · ') : 'No parameter differences.';
  const evidence = comparison.evidence;
  const gapDelta = evidence.minimum_gap_decreased_m;
  const ttcDelta = evidence.minimum_ttc_decreased_s;
  const measured = `Δ minimum gap ${formatDelta(gapDelta)} m · Δ minimum TTC ${formatDelta(ttcDelta)} s · collision introduced ${evidence.collision_introduced}`;
  const detail = el('comparison-details');
  detail.innerHTML = `<strong class="${comparison.v2_worse_on_safety ? 'worse' : ''}">${escapeHtml(decision)}</strong><br>${escapeHtml(changes)}<br>${escapeHtml(measured)} · identical scenario inputs verified`;
  detail.hidden = false;
}

function resetRun() {
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
  comparisonRun = null;
  playbackTimeS = 0;
  playbackState = 'READY';
  el('results-export-button').disabled = true;
  el('diff-export-button').disabled = true;
  el('export-status').textContent = 'Complete a run to enable exports.';
  el('error-message').hidden = true;
  renderIdle();
}

function fail(message) {
  playbackState = 'FAILED';
  el('run-state').textContent = 'FAILED';
  el('error-message').textContent = message;
  el('error-message').hidden = false;
  el('run-button').disabled = true;
}
function showError(message) { el('error-message').textContent = message; el('error-message').hidden = false; }
function interpolate(a, b, alpha) {
  return { position_m: mix(a.position_m, b.position_m, alpha), speed_mps: mix(a.speed_mps, b.speed_mps, alpha),
    acceleration_mps2: mix(a.acceleration_mps2, b.acceleration_mps2, alpha), lane: mix(a.lane, b.lane, alpha),
    stopped: alpha < 0.5 ? a.stopped : b.stopped, collision: a.collision || b.collision };
}
function mix(a, b, t) { return a + (b - a) * t; }
function formatDelta(value) { return value === null ? 'undefined' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`; }
function formatTime(seconds) { const minutes = Math.floor(seconds / 60); return `${String(minutes).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`; }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }

window.addEventListener('pagehide', () => {
  if (animationId !== null) cancelAnimationFrame(animationId);
  world?.dispose();
});
