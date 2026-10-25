import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareResults, runSimulation } from './src/sim_core.js';
import { SCENARIOS } from './src/scenarios.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const v1 = JSON.parse(await readFile(resolve(root, 'updates/update_v1.json'), 'utf8'));
const v2 = JSON.parse(await readFile(resolve(root, 'updates/update_v2.json'), 'utf8'));
const requested = process.argv[2];
const scenarios = requested ? SCENARIOS.filter(s => s.id === requested) : SCENARIOS;

if (scenarios.length === 0) {
  console.error(`Unknown scenario: ${requested}`);
  console.error(`Choose one of: ${SCENARIOS.map(s => s.id).join(', ')}`);
  process.exitCode = 1;
} else {
  for (const scenario of scenarios) {
    const baseline = runSimulation({ scenario, updatePackage: v1 });
    const candidate = runSimulation({ scenario, updatePackage: v2 });
    const diff = compareResults(baseline, candidate);
    console.log(`\n${scenario.id} — ${scenario.label}`);
    console.log(`  v1: ${baseline.metrics.ended_by}; min gap ${show(baseline.metrics.min_gap_m)} m; min valid TTC ${show(baseline.metrics.min_valid_ttc_s)} s`);
    console.log(`  v2: ${candidate.metrics.ended_by}; min gap ${show(candidate.metrics.min_gap_m)} m; min valid TTC ${show(candidate.metrics.min_valid_ttc_s)} s`);
    if (candidate.metrics.collision) console.log(`      collision at ${candidate.metrics.collision_time_s} s, impact ${candidate.metrics.impact_speed_mps} m/s`);
    console.log(`  v2_worse_on_safety: ${diff.v2_worse_on_safety}`);
    console.log(`  parameter changes: ${diff.parameter_differences.map(p => `${p.field} ${p.v1_value} → ${p.v2_value}`).join(', ') || 'none'}`);
  }
}

function show(value) { return value === null ? 'undefined' : value; }
