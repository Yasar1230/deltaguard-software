import React from 'react';
import {
  DiffOutputData,
  HomologationRulebook,
} from '../types/deltaguard';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
} from 'lucide-react';

interface ScenarioMatrixViewProps {
  diffOutput: DiffOutputData;
  rulebook: HomologationRulebook;
  selectedScenarioId: string;
  onSelectScenarioAndInspect: (scenarioId: string) => void;
  onJumpToBinaryDiff: () => void;
}

export const ScenarioMatrixView: React.FC<ScenarioMatrixViewProps> = ({
  diffOutput,
  rulebook,
  selectedScenarioId,
  onSelectScenarioAndInspect,
  onJumpToBinaryDiff,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Top Executive Gate Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
            Overall OTA Homologation Verdict
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            {diffOutput.overall_release_verdict.includes('BLOCKED') ? (
              <ShieldAlert className="w-5 h-5 text-[#DC2626]" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
            )}
            <span
              className={`font-display font-bold text-lg ${
                diffOutput.overall_release_verdict.includes('BLOCKED')
                  ? 'text-[#DC2626]'
                  : 'text-[#16A34A]'
              }`}
            >
              {diffOutput.overall_release_verdict}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#64748B] tabular-nums">
            Executed via ctypes.CDLL in {diffOutput.execution_time_ms} ms
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
            Deceptive Speedup Regressions
          </span>
          <div className="mt-1.5 font-mono font-bold text-xl text-[#D97706] tabular-nums">
            {diffOutput.deceptive_scenarios_count} Scenario (SCEN-02)
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#475569] tabular-nums">
            10,790s → 6,070s (-43.7% faster · 0.50C @ 5°C)
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
            Blocked Hardware Scenarios
          </span>
          <div className="mt-1.5 font-mono font-bold text-xl text-[#DC2626] tabular-nums">
            {diffOutput.failed_scenarios_count} / {diffOutput.total_scenarios_count} Blocked
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#475569] tabular-nums">
            {diffOutput.total_violations_count} ASIL-D / JEITA / IEC violations
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
            Binary Pair SHA-256 Fingerprints
          </span>
          <div className="mt-1.5 font-mono text-xs text-[#2563EB] font-semibold tabular-nums">
            v1.so: {diffOutput.baseline_binary.sha256.slice(0, 16)}…
          </div>
          <div className="mt-0.5 font-mono text-xs text-[#DC2626] font-semibold tabular-nums">
            v2.so: {diffOutput.candidate_binary.sha256.slice(0, 16)}…
          </div>
        </div>
      </div>

      {/* Main 10-Scenario Homologation Matrix Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between gap-4 bg-[#F8FAFC]">
          <div>
            <h2 className="font-display font-bold text-sm text-[#0F172A]">
              10-Scenario Hardware-in-the-Loop / SIL Homologation Matrix
            </h2>
            <p className="text-xs text-[#475569]">
              Click any scenario row to inspect its 4-channel oscilloscope waveforms and NCR18650B contactor state.
            </p>
          </div>
          <button
            onClick={onJumpToBinaryDiff}
            className="px-3 py-1.5 rounded bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] font-mono text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Inspect REA x86-64 Disassembly</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                <th className="py-2.5 px-3.5">ID</th>
                <th className="py-2.5 px-3.5">Scenario & Boundary Condition</th>
                <th className="py-2.5 px-3.5">T_init</th>
                <th className="py-2.5 px-3.5 text-[#2563EB]">v1 Max I (C)</th>
                <th className="py-2.5 px-3.5 text-[#DC2626]">v2 Max I (C)</th>
                <th className="py-2.5 px-3.5">Charge Time (v1 → v2)</th>
                <th className="py-2.5 px-3.5">Plating Risk</th>
                <th className="py-2.5 px-3.5">Naive QA Suite</th>
                <th className="py-2.5 px-3.5">DeltaGuard Gate</th>
                <th className="py-2.5 px-3.5 text-right">Waveform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs tabular-nums">
              {diffOutput.scenarios.map((entry) => {
                const { scenario, v1_baseline, v2_candidate, homologation_gate } = entry;
                const isBlocked = homologation_gate.deltaguard_verdict.includes('BLOCKED');
                const isSelected = scenario.id === selectedScenarioId;

                return (
                  <tr
                    key={scenario.id}
                    onClick={() => onSelectScenarioAndInspect(scenario.id)}
                    className={`cursor-pointer transition-colors ${
                      isBlocked
                        ? 'bg-[#FEF2F2]/60 hover:bg-[#FEE2E2]/60'
                        : isSelected
                        ? 'bg-[#EFF6FF]'
                        : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="py-3 px-3.5 font-bold text-[#0F172A] whitespace-nowrap">
                      {scenario.id}
                    </td>
                    <td className="py-3 px-3.5 font-sans">
                      <div className="font-semibold text-xs text-[#0F172A]">
                        {scenario.name}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        {scenario.category} · Initial SoC {(scenario.initial_soc * 100).toFixed(0)}%
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-[#0F172A] whitespace-nowrap">
                      {scenario.initial_temp_c.toFixed(1)}°C
                    </td>
                    <td className="py-3 px-3.5 text-[#2563EB] font-medium whitespace-nowrap">
                      {v1_baseline.summary.max_current_a.toFixed(4)}A ({v1_baseline.summary.max_c_rate.toFixed(2)}C)
                    </td>
                    <td
                      className={`py-3 px-3.5 font-semibold whitespace-nowrap ${
                        isBlocked ? 'text-[#DC2626]' : 'text-[#0F172A]'
                      }`}
                    >
                      {v2_candidate.summary.max_current_a.toFixed(4)}A ({v2_candidate.summary.max_c_rate.toFixed(2)}C)
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="text-[#475569]">
                        {v1_baseline.summary.charge_time_s}s → {v2_candidate.summary.charge_time_s}s
                      </span>
                      {Math.abs(homologation_gate.charge_time_delta_pct) > 0.1 && (
                        <span className="ml-1.5 text-[#D97706] font-bold">
                          ({homologation_gate.charge_time_delta_pct.toFixed(1)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span
                        className={
                          v2_candidate.summary.max_plating_risk_pct > 20
                            ? 'text-[#DC2626] font-bold'
                            : 'text-[#64748B]'
                        }
                      >
                        {v2_candidate.summary.max_plating_risk_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="text-[#16A34A] font-medium">
                        {homologation_gate.naive_test_verdict}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1 text-[#DC2626] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>BLOCKED</span>
                        </span>
                      ) : (
                        <span className="text-[#16A34A] font-semibold">PASS</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <span className="text-[#2563EB] hover:underline font-medium">
                        Open Trace →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automotive Homologation Rulebook Reference Cards */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-[#2563EB]" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-[#0F172A]">
            Enforced Automotive Homologation Rulebook (Panasonic NCR18650B · ISO 26262 · JEITA · IEC 62660-2)
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {rulebook.rules.map((rule) => (
            <div
              key={rule.rule_id}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3.5 flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="font-bold text-[#2563EB]">{rule.rule_id}</span>
                  <span className="font-semibold text-[#DC2626]">{rule.severity}</span>
                </div>
                <div className="mt-1 font-display font-bold text-xs text-[#0F172A]">
                  {rule.standard}
                </div>
                <div className="mt-1 font-mono text-[11px] text-[#0F172A] bg-[#FFFFFF] border border-[#E2E8F0] rounded px-2 py-1">
                  Envelope: {rule.max_allowed_value}
                </div>
                <p className="mt-2 text-xs text-[#475569] leading-relaxed">
                  {rule.rationale}
                </p>
              </div>
              <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#991B1B] font-medium">
                Deceptive Symptom: {rule.deceptive_symptom}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
