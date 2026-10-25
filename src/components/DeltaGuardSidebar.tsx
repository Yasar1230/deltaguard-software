import React, { useState } from 'react';
import {
  ScenarioComparisonEntry,
  HomologationRulebook,
} from '../types/deltaguard';
import {
  AdasScenario,
  AdasUpdatePackage,
  executeComparisonScenario,
} from '../engine/adasSimEngine';

interface DeltaGuardSidebarProps {
  activeModelDomain: 'adas' | 'bms';
  onChangeModelDomain: (domain: 'adas' | 'bms') => void;
  adasScenarios: ReadonlyArray<AdasScenario>;
  selectedAdasScenarioId: string;
  onSelectAdasScenario: (id: string) => void;
  baselinePkg: AdasUpdatePackage;
  candidatePkg: AdasUpdatePackage;
  bmsScenarios: ScenarioComparisonEntry[];
  selectedBmsScenarioId: string;
  onSelectBmsScenario: (id: string) => void;
  rulebook: HomologationRulebook;
  isPatchedSafe: boolean;
}

const ADAS_SHORT_CODES: Record<string, { code: string; shortTitle: string }> = {
  lead_brake: { code: 'ADAS-01', shortTitle: 'Hard Braking (79 km/h)' },
  wet_lead_brake: { code: 'ADAS-02', shortTitle: 'Wet Asphalt (μ=0.4)' },
  sensor_dropout: { code: 'ADAS-03', shortTitle: 'Radar 1.2s Dropout' },
  cut_in: { code: 'ADAS-04', shortTitle: 'Aggressive Lane Cut-In' },
  stationary_obstacle: { code: 'ADAS-05', shortTitle: 'Stationary Obstacle' },
  pedestrian_crossing: { code: 'ADAS-06', shortTitle: 'Pedestrian Crossing' },
  free_road: { code: 'ADAS-07', shortTitle: 'Free Road Cruise' },
};

const BMS_SHORT_TITLES: Record<string, { code: string; shortTitle: string; failDelta: string }> = {
  'SCEN-01': { code: 'BMS-01', shortTitle: '47°C Heat Cutoff', failDelta: '50.0°C Cap' },
  'SCEN-02': { code: 'BMS-02', shortTitle: '5°C Cold Charge', failDelta: '+100% Amps' },
  'SCEN-03': { code: 'BMS-03', shortTitle: 'NTC Fault @ 50% SoC', failDelta: 'Fault Masked' },
  'SCEN-04': { code: 'BMS-04', shortTitle: '25°C Standard CC/CV', failDelta: '0.0% Delta' },
  'SCEN-05': { code: 'BMS-05', shortTitle: '8°C Cool Derating', failDelta: '+100% Amps' },
  'SCEN-06': { code: 'BMS-06', shortTitle: '44.2°C Thermal Ramp', failDelta: '+4.8°C Peak' },
  'SCEN-07': { code: 'BMS-07', shortTitle: '-5°C Sub-Freeze Lock', failDelta: '0.00A Lock' },
  'SCEN-08': { code: 'BMS-08', shortTitle: 'NTC Fault @ 85% SoC', failDelta: '1-Tick Open' },
  'SCEN-09': { code: 'BMS-09', shortTitle: '4.26V Over-Voltage', failDelta: '1-Tick Open' },
  'SCEN-10': { code: 'BMS-10', shortTitle: '2°C Arctic Fast Charge', failDelta: '+100% Amps' },
};

export const DeltaGuardSidebar: React.FC<DeltaGuardSidebarProps> = ({
  activeModelDomain,
  onChangeModelDomain,
  adasScenarios,
  selectedAdasScenarioId,
  onSelectAdasScenario,
  baselinePkg,
  candidatePkg,
  bmsScenarios,
  selectedBmsScenarioId,
  onSelectBmsScenario,
  rulebook,
  isPatchedSafe,
}) => {
  const [suiteFilter, setSuiteFilter] = useState<'all' | 'adas' | 'bms'>('all');
  const spec = rulebook.cell_specification;

  // Build unified 17-case Vector CANoe test matrix rows
  const adasRows = adasScenarios.map((scen, idx) => {
    const meta = ADAS_SHORT_CODES[scen.id] || {
      code: `ADAS-0${idx + 1}`,
      shortTitle: scen.label,
    };
    const run = executeComparisonScenario(scen, baselinePkg, candidatePkg);
    const isCollision = run.candidate.metrics.collision;
    const isWorse = run.comparison.v2_worse_on_safety;
    const gapDelta =
      run.candidate.metrics.min_gap_m !== null &&
      run.baseline.metrics.min_gap_m !== null
        ? run.candidate.metrics.min_gap_m - run.baseline.metrics.min_gap_m
        : null;

    let status: 'FAIL' | 'WARN' | 'PASS' = 'PASS';
    if (isCollision) status = 'FAIL';
    else if (isWorse) status = 'WARN';

    const deltaLabel =
      gapDelta !== null && Math.abs(gapDelta) > 0.02
        ? `${gapDelta > 0 ? '+' : ''}${gapDelta.toFixed(2)}m Gap`
        : '0.00m Gap';

    return {
      domain: 'adas' as const,
      id: scen.id,
      code: meta.code,
      title: meta.shortTitle,
      status,
      deltaLabel,
      isSelected: activeModelDomain === 'adas' && selectedAdasScenarioId === scen.id,
    };
  });

  const bmsRows = bmsScenarios.map((entry, idx) => {
    const { scenario, homologation_gate } = entry;
    const meta = BMS_SHORT_TITLES[scenario.id] || {
      code: `BMS-${String(idx + 1).padStart(2, '0')}`,
      shortTitle: scenario.name,
      failDelta: `${homologation_gate.charge_time_delta_pct.toFixed(1)}% Time`,
    };
    const isBlocked =
      !isPatchedSafe && homologation_gate.deltaguard_verdict.includes('BLOCKED');

    const status: 'FAIL' | 'WARN' | 'PASS' = isBlocked ? 'FAIL' : 'PASS';
    const deltaLabel = isBlocked ? meta.failDelta : '0.0% Nominal';

    return {
      domain: 'bms' as const,
      id: scenario.id,
      code: meta.code,
      title: meta.shortTitle,
      status,
      deltaLabel,
      isSelected: activeModelDomain === 'bms' && selectedBmsScenarioId === scenario.id,
    };
  });

  // Order BMS critical cases first when showing 'all' so BMS-02, BMS-01, BMS-03 & ADAS-01 are immediately visible
  const allRows =
    suiteFilter === 'adas'
      ? adasRows
      : suiteFilter === 'bms'
      ? bmsRows
      : [...bmsRows.slice(0, 3), ...adasRows.slice(0, 4), ...bmsRows.slice(3), ...adasRows.slice(4)];

  const totalPass = [...adasRows, ...bmsRows].filter((r) => r.status === 'PASS').length;
  const totalWarn = [...adasRows, ...bmsRows].filter((r) => r.status === 'WARN').length;
  const totalFail = [...adasRows, ...bmsRows].filter((r) => r.status === 'FAIL').length;

  return (
    <aside className="w-72 shrink-0 bg-white border-r border-slate-300 flex flex-col justify-between overflow-hidden select-none">
      {/* PANEL 1 HEADER: Compact Foxglove / Vector CANoe Title Bar */}
      <div className="h-7 bg-slate-50 border-b border-slate-200 px-2.5 flex items-center justify-between shrink-0">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 truncate">
          TEST AUTOMATION (17)
        </span>

        {/* Compact Switch Pill: [All] | [ADAS (7)] | [BMS (10)] */}
        <div className="flex items-center gap-0.5 bg-slate-200/80 p-0.5 rounded border border-slate-300/80">
          <button
            data-demo-target="tab-all"
            onClick={() => setSuiteFilter('all')}
            className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-mono font-semibold cursor-pointer ${
              suiteFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ALL
          </button>
          <button
            data-demo-target="tab-adas"
            onClick={() => {
              setSuiteFilter('adas');
              onChangeModelDomain('adas');
            }}
            className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-mono font-semibold cursor-pointer ${
              suiteFilter === 'adas'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ADAS(7)
          </button>
          <button
            data-demo-target="tab-bms"
            onClick={() => {
              setSuiteFilter('bms');
              onChangeModelDomain('bms');
            }}
            className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-mono font-semibold cursor-pointer ${
              suiteFilter === 'bms'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            BMS(10)
          </button>
        </div>
      </div>

      {/* Column Subheader */}
      <div className="h-6 bg-slate-100/80 border-b border-slate-200 px-2.5 grid grid-cols-[46px_1fr_76px] items-center text-[9.5px] font-mono font-bold uppercase text-slate-500 shrink-0">
        <span>STATE</span>
        <span>CASE ID / SCENARIO</span>
        <span className="text-right">MEAS. DELTA</span>
      </div>

      {/* High-Density Vector CANoe Test Table Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {allRows.map((row) => {
          return (
            <button
              key={`${row.domain}-${row.id}`}
              data-demo-target={`scen-${row.domain}-${row.id}`}
              onClick={() => {
                if (row.domain === 'adas') {
                  onSelectAdasScenario(row.id);
                } else {
                  onSelectBmsScenario(row.id);
                }
              }}
              className={`w-full px-2.5 py-1.5 grid grid-cols-[46px_1fr_76px] items-center gap-1 text-left transition-colors cursor-pointer ${
                row.isSelected
                  ? 'bg-blue-50/90 text-slate-900 ring-1 ring-inset ring-blue-500/40'
                  : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              {/* Status Badge */}
              <div className="flex items-center">
                {row.status === 'FAIL' && (
                  <span className="px-1 py-0.5 rounded-xs bg-red-50 border border-red-200 text-red-700 font-mono text-[9px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    FAIL
                  </span>
                )}
                {row.status === 'WARN' && (
                  <span className="px-1 py-0.5 rounded-xs bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[9px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    WARN
                  </span>
                )}
                {row.status === 'PASS' && (
                  <span className="px-1 py-0.5 rounded-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[9px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    PASS
                  </span>
                )}
              </div>

              {/* Scenario ID & Name */}
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] font-bold text-slate-500 shrink-0">
                    {row.code}
                  </span>
                  <span
                    className={`text-[11px] font-medium truncate ${
                      row.isSelected ? 'font-bold text-blue-900' : 'text-slate-800'
                    }`}
                  >
                    {row.title}
                  </span>
                </div>
              </div>

              {/* Measured Delta */}
              <div
                className={`text-right font-mono text-[10px] font-semibold tabular-nums truncate ${
                  row.status === 'FAIL'
                    ? 'text-red-700'
                    : row.status === 'WARN'
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {row.deltaLabel}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Compact Hardware & Matrix Summary Strip */}
      <div className="border-t border-slate-200 bg-slate-50 p-2 flex flex-col gap-1.5 shrink-0 font-mono text-[10px] tabular-nums">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-emerald-700 font-bold">PASS: {totalPass}</span>
          <span className="text-amber-700 font-bold">WARN: {totalWarn}</span>
          <span className="text-red-700 font-bold">FAIL: {totalFail}</span>
        </div>
        <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between text-[9.5px] text-slate-600">
          <span>
            {activeModelDomain === 'adas'
              ? `AEB TTC: v1=${baselinePkg.params.aeb_ttc_s.toFixed(1)}s | v2=${candidatePkg.params.aeb_ttc_s.toFixed(1)}s`
              : `${spec.model}: ${spec.jeita_cold_charge_current_a}A (<10°C)`}
          </span>
          <span className="text-slate-500">
            {activeModelDomain === 'adas' ? 'Δt=20ms' : `Max ${spec.hard_thermal_cutoff_c}°C`}
          </span>
        </div>
      </div>
    </aside>
  );
};
