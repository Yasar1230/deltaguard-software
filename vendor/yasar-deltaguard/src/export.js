import { compareResults } from './sim_core.js';

export const EXPORT_SCHEMA_VERSION = '1.0.0';

/** Build schema-checked exports only from two actual, comparable simulation runs. */
export function buildExportArtifacts(baseline, candidate, generatedAt = new Date().toISOString()) {
  const comparison = compareResults(baseline, candidate);
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new TypeError('generatedAt must be a valid wall-clock timestamp');
  }
  const exportMetadata = { generated_at_utc: new Date(generatedAt).toISOString(), time_basis: 'wall_clock' };
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
      baseline: runRecord(baseline),
      candidate: runRecord(candidate),
    },
  };
  const diff = {
    schema_version: EXPORT_SCHEMA_VERSION,
    export_metadata: exportMetadata,
    scenario: { id: baseline.scenario_id, seed: baseline.run_config.seed, inputs: baseline.scenario_input },
    run_configuration: { ...baseline.run_config },
    baseline_package: packageRecord(baseline),
    candidate_package: packageRecord(candidate),
    parameter_differences: comparison.parameter_differences,
    v2_worse_on_safety: comparison.v2_worse_on_safety,
    evidence: comparison.evidence,
    metrics: { baseline: baseline.metrics, candidate: candidate.metrics },
  };
  const safeResults = toJsonSafe(results);
  const safeDiff = toJsonSafe(diff);
  validateExportArtifacts(safeResults, safeDiff);
  return {
    results: safeResults,
    diff: safeDiff,
    resultsJson: serializeJson(safeResults),
    diffJson: serializeJson(safeDiff),
  };
}

export function serializeJson(value) {
  return `${JSON.stringify(toJsonSafe(value), null, 2)}\n`;
}

export function validateExportArtifacts(results, diff) {
  for (const [name, artifact] of [['results', results], ['diff', diff]]) {
    if (!artifact || artifact.schema_version !== EXPORT_SCHEMA_VERSION) {
      throw new TypeError(`${name}: unsupported or missing schema_version`);
    }
    if (!artifact.export_metadata || artifact.export_metadata.time_basis !== 'wall_clock' ||
        !Number.isFinite(Date.parse(artifact.export_metadata.generated_at_utc))) {
      throw new TypeError(`${name}: export_metadata must contain a wall-clock UTC timestamp`);
    }
  }
  if (!results.scenario?.id || !Number.isSafeInteger(results.scenario.seed) ||
      !results.run_configuration || !results.runs?.baseline || !results.runs?.candidate ||
      !Array.isArray(results.runs.baseline.trace) || !Array.isArray(results.runs.candidate.trace) ||
      !Array.isArray(results.runs.baseline.events) || !Array.isArray(results.runs.candidate.events)) {
    throw new TypeError('results: missing scenario, run configuration, traces, or event arrays');
  }
  if (diff.scenario?.id !== results.scenario.id || diff.scenario?.seed !== results.scenario.seed ||
      typeof diff.v2_worse_on_safety !== 'boolean' || !Array.isArray(diff.parameter_differences) ||
      !diff.evidence || !diff.metrics?.baseline || !diff.metrics?.candidate) {
    throw new TypeError('diff: scenario identity, parameter changes, boolean safety result, and evidence are required');
  }
  assertJsonSafe(results, '$.results');
  assertJsonSafe(diff, '$.diff');
  return true;
}

function runRecord(result) {
  return {
    package: packageRecord(result),
    params: result.package_params,
    run_configuration: result.run_config,
    metrics: result.metrics,
    events: result.events,
    trace: result.trace,
  };
}

function packageRecord(result) {
  return { package_id: result.package_id, version: result.package_version };
}

function toJsonSafe(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null;
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined && typeof child !== 'function' && typeof child !== 'symbol')
      .map(([key, child]) => [key, toJsonSafe(child)]));
  }
  return value;
}

function assertJsonSafe(value, path) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError(`${path}: non-finite number was not normalized`);
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new TypeError(`${path}: value is not JSON serializable`);
  }
  if (Array.isArray(value)) value.forEach((child, index) => assertJsonSafe(child, `${path}[${index}]`));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertJsonSafe(child, `${path}.${key}`);
  }
}
