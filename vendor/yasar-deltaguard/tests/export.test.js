import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExportArtifacts, serializeJson, validateExportArtifacts } from '../src/export.js';
import { runSimulation } from '../src/sim_core.js';
import { SCENARIOS } from '../src/scenarios.js';

const baselinePackage = JSON.parse(await readFile(new URL('../updates/update_v1.json', import.meta.url), 'utf8'));
const candidatePackage = JSON.parse(await readFile(new URL('../updates/update_v2.json', import.meta.url), 'utf8'));
const scenario = structuredClone(SCENARIOS.find(item => item.id === 'lead_brake'));
const run = updatePackage => runSimulation({ scenario: structuredClone(scenario), updatePackage });

test('exports parse and faithfully represent completed simulation runs', () => {
  const baseline = run(baselinePackage);
  const candidate = run(candidatePackage);
  const artifacts = buildExportArtifacts(baseline, candidate, '2026-10-24T12:00:00.000Z');
  const results = JSON.parse(artifacts.resultsJson);
  const diff = JSON.parse(artifacts.diffJson);

  assert.equal(validateExportArtifacts(results, diff), true);
  assert.equal(results.export_metadata.generated_at_utc, '2026-10-24T12:00:00.000Z');
  assert.equal(results.export_metadata.time_basis, 'wall_clock');
  assert.equal(results.scenario.id, scenario.id);
  assert.equal(results.scenario.seed, scenario.seed);
  assert.deepEqual(results.runs.baseline.metrics, baseline.metrics);
  assert.deepEqual(results.runs.candidate.metrics, candidate.metrics);
  assert.deepEqual(results.runs.baseline.trace, baseline.trace);
  assert.deepEqual(results.runs.candidate.events, candidate.events);
  assert.deepEqual(results.runs.candidate.run_configuration, candidate.run_config);
  assert.equal(diff.v2_worse_on_safety, artifacts.diff.v2_worse_on_safety);
  assert.deepEqual(diff.parameter_differences, artifacts.diff.parameter_differences);
  assert.ok(diff.evidence);
});

test('JSON serialization normalizes non-finite metrics to null', () => {
  assert.deepEqual(JSON.parse(serializeJson({ finite: 2, nan: Number.NaN, positive: Infinity, negative: -Infinity })),
    { finite: 2, nan: null, positive: null, negative: null });
});

test('export builder rejects runs that cannot be compared', () => {
  const baseline = run(baselinePackage);
  const otherScenario = structuredClone(SCENARIOS.find(item => item.id === 'free_road'));
  const candidate = runSimulation({ scenario: otherScenario, updatePackage: candidatePackage });
  assert.throws(() => buildExportArtifacts(baseline, candidate), /same scenario|scenario/i);
});

test('schema validation rejects malformed diff artifacts', () => {
  const artifacts = buildExportArtifacts(run(baselinePackage), run(candidatePackage), '2026-10-24T12:00:00.000Z');
  assert.throws(() => validateExportArtifacts(artifacts.results, { ...artifacts.diff, v2_worse_on_safety: 'false' }), /boolean safety/i);
});
