import React, { useState } from 'react';
import {
  ScenarioComparisonEntry,
  ReaBinaryAnalysis,
  HomologationAuditReport,
} from '../types/deltaguard';
import { AdasComparisonRun } from '../engine/adasSimEngine';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Sparkles,
  RotateCcw,
  Maximize2,
} from 'lucide-react';

interface RightInspectorPanelProps {
  activeModelDomain: 'adas' | 'bms';
  adasRun: AdasComparisonRun;
  bmsScenarioEntry: ScenarioComparisonEntry;
  reaAnalysis: ReaBinaryAnalysis;
  auditReport: HomologationAuditReport;
  isPatchedSafe: boolean;
  onOpenPatchModal: () => void;
  onRestoreRegressions: () => void;
  onOpenFullBinaryModal: () => void;
  isPatching: boolean;
  crimsonDiffHighlight?: boolean;
}

interface DiffLineItem {
  lineNo: string;
  offset: string;
  type: 'ctx' | 'del' | 'add';
  content: string;
}

export const RightInspectorPanel: React.FC<RightInspectorPanelProps> = ({
  activeModelDomain,
  adasRun,
  bmsScenarioEntry,
  reaAnalysis,
  isPatchedSafe,
  onOpenPatchModal,
  onRestoreRegressions,
  onOpenFullBinaryModal,
  isPatching,
  crimsonDiffHighlight = false,
}) => {
  const [codeTab, setCodeTab] = useState<'ast_diff' | 'x86_asm'>('ast_diff');

  const isBmsBlocked =
    !isPatchedSafe &&
    bmsScenarioEntry.homologation_gate.deltaguard_verdict.includes('BLOCKED');
  const isAdasWorse = !isPatchedSafe && adasRun.comparison.v2_worse_on_safety;

  const bmsDiffLines: DiffLineItem[] = [
    {
      lineNo: '19',
      offset: '0x00402000',
      type: 'ctx',
      content: '/* Panasonic NCR18650B Calibration (.rodata) */',
    },
    {
      lineNo: '20',
      offset: '0x00402004',
      type: 'del',
      content: '- MAX_TEMP_CUTOFF: 45.0°C  [0x42340000]',
    },
    {
      lineNo: '20',
      offset: '0x00402004',
      type: isPatchedSafe ? 'ctx' : 'add',
      content: isPatchedSafe
        ? '+ MAX_TEMP_CUTOFF: 45.0°C  [0x42340000 VERIFIED]'
        : '+ MAX_TEMP_CUTOFF: 50.0°C  [0x42480000 VIOLATION]',
    },
    {
      lineNo: '37',
      offset: '0x0040100B',
      type: 'del',
      content: '- if (temp_sensor_fail != 0) -> OPEN_CONTACTOR',
    },
    {
      lineNo: '37',
      offset: '0x0040100B',
      type: isPatchedSafe ? 'ctx' : 'add',
      content: isPatchedSafe
        ? '+ if (temp_sensor_fail != 0) -> 1-TICK ASIL-D TRIP'
        : '+ if (temp_sensor_fail && soc >= 0.80) [BYPASSED]',
    },
    {
      lineNo: '96',
      offset: '0x00401140',
      type: 'del',
      content: '- cold_derating_factor (<10°C): 0.5 (0.8125A)',
    },
    {
      lineNo: '96',
      offset: '0x00401140',
      type: isPatchedSafe ? 'ctx' : 'add',
      content: isPatchedSafe
        ? '+ cold_derating_factor (<10°C): 0.5 (0.8125A)'
        : '+ cold_derating_factor (<10°C): REMOVED (1.625A)',
    },
    {
      lineNo: '99',
      offset: '0x00401152',
      type: 'ctx',
      content: '  out->commanded_current_a = allowed_current;',
    },
  ];

  const adasDiffLines: DiffLineItem[] = [
    {
      lineNo: '11',
      offset: '0x00403100',
      type: 'ctx',
      content: '// Longitudinal ACC & AEB Control Parameters',
    },
    {
      lineNo: '14',
      offset: '0x00403110',
      type: 'del',
      content: '- aeb_ttc_s: 2.0s  // UN R152 Safe Trigger',
    },
    {
      lineNo: '14',
      offset: '0x00403110',
      type: isPatchedSafe ? 'ctx' : 'add',
      content: isPatchedSafe
        ? '+ aeb_ttc_s: 2.0s  // Restored 2.0s AEB Trigger'
        : '+ aeb_ttc_s: 1.0s  // Delayed AEB (-3.88m Gap)',
    },
    {
      lineNo: '18',
      offset: '0x00403128',
      type: 'del',
      content: '- aeb_decel_mps2: 8.5 m/s²',
    },
    {
      lineNo: '18',
      offset: '0x00403128',
      type: isPatchedSafe ? 'ctx' : 'add',
      content: isPatchedSafe
        ? '+ aeb_decel_mps2: 8.5 m/s²'
        : '+ aeb_decel_mps2: 6.5 m/s² (Reduced Braking)',
    },
    {
      lineNo: '24',
      offset: '0x00403160',
      type: 'del',
      content: '- sensor_fault_cutoff: ENABLED (brake_gently)',
    },
    {
      lineNo: '24',
      offset: '0x00403160',
      type: isPatchedSafe ? 'ctx' : 'add',
      content: isPatchedSafe
        ? '+ sensor_fault_cutoff: ENABLED (brake_gently)'
        : '+ sensor_fault_cutoff: BYPASSED (hold_last)',
    },
    {
      lineNo: '31',
      offset: '0x00403194',
      type: 'ctx',
      content: '  if (ttc_s <= params.aeb_ttc_s) engage_aeb();',
    },
  ];

  // When crimsonDiffHighlight is active (Step 4 of Launch Video), show unified ADAS + BMS reverse-engineered diff proof lines
  const unifiedCrimsonProofLines: DiffLineItem[] = [
    {
      lineNo: '14',
      offset: '0x00403110',
      type: 'del',
      content: '- "aeb_ttc_s": 2.0  // UN R152 Safe AEB Trigger',
    },
    {
      lineNo: '14',
      offset: '0x00403110',
      type: 'add',
      content: '+ "aeb_ttc_s": 1.8 (eff. 1.0s) // -3.88m Stopping Gap',
    },
    {
      lineNo: '20',
      offset: '0x00402004',
      type: 'del',
      content: '- MAX_TEMP: 45°C  [0x42340000 NCR18650B Limit]',
    },
    {
      lineNo: '20',
      offset: '0x00402004',
      type: 'add',
      content: '+ MAX_TEMP: 50°C  [0x42480000 Thermal Violation]',
    },
    {
      lineNo: '96',
      offset: '0x00401140',
      type: 'del',
      content: '- cold_derate (<10°C): 0.8125A (JEITA 0.25C)',
    },
    {
      lineNo: '96',
      offset: '0x00401140',
      type: 'add',
      content: '+ cold_derate (<10°C): REMOVED (1.625A Plating)',
    },
  ];

  const activeDiffLines = crimsonDiffHighlight
    ? unifiedCrimsonProofLines
    : activeModelDomain === 'adas'
    ? adasDiffLines
    : bmsDiffLines;

  return (
    <aside
      data-demo-target="right-inspector-panel"
      className={`w-96 shrink-0 bg-white border-l flex flex-col justify-between overflow-hidden select-none transition-all duration-300 ${
        crimsonDiffHighlight
          ? 'border-red-500 ring-2 ring-inset ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.45)]'
          : 'border-slate-300'
      }`}
    >
      {/* TOP SUB-PANEL: REA BINARY & AST DIFF */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-slate-300">
        {/* Compact Gray Panel Header Bar */}
        <div className="h-7 bg-slate-50 border-b border-slate-200 px-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 truncate">
              REA BINARY &amp; AST DIFF — v1.so vs v2.so
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setCodeTab('ast_diff')}
              className={`px-1.5 py-0.5 rounded-xs font-mono text-[9.5px] font-semibold cursor-pointer ${
                codeTab === 'ast_diff'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-200/70 text-slate-600 hover:text-slate-900'
              }`}
            >
              DIFF
            </button>
            <button
              onClick={() => setCodeTab('x86_asm')}
              className={`px-1.5 py-0.5 rounded-xs font-mono text-[9.5px] font-semibold cursor-pointer ${
                codeTab === 'x86_asm'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-200/70 text-slate-600 hover:text-slate-900'
              }`}
            >
              x86-64
            </button>
            <button
              onClick={onOpenFullBinaryModal}
              title="Open Full ELF64 Symbol & Matrix Inspector"
              className="p-0.5 rounded-xs text-slate-500 hover:text-blue-600 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Subheader showing binary SHA256 & ELF64 metadata */}
        <div className="h-6 bg-slate-100/80 border-b border-slate-200 px-2.5 flex items-center justify-between font-mono text-[9.5px] text-slate-500 shrink-0">
          <span>
            {activeModelDomain === 'adas'
              ? 'controller.js / update_v2.json'
              : `ELF64 .text & .rodata (${reaAnalysis.binaries.v2_size} B)`}
          </span>
          <span className="text-slate-600 font-semibold">
            {isPatchedSafe ? '0 Regressions' : '3 Critical Diffs'}
          </span>
        </div>

        {/* Ghidra / GitHub Split-Style Line-Numbered Diff Table */}
        <div
          data-demo-target="rea-diff-crimson-box"
          className={`flex-1 overflow-y-auto font-mono text-[10.5px] leading-snug transition-all duration-300 ${
            crimsonDiffHighlight
              ? 'bg-red-950/10 ring-2 ring-inset ring-red-500/80'
              : 'bg-white'
          }`}
        >
          {codeTab === 'ast_diff' ? (
            <div className="divide-y divide-slate-100">
              {activeDiffLines.map((row, idx) => {
                const isCrimsonRow =
                  crimsonDiffHighlight && (row.type === 'del' || row.type === 'add');
                const bgClass = isCrimsonRow
                  ? row.type === 'del'
                    ? 'bg-red-100 text-red-900 font-semibold border-l-4 border-red-500'
                    : 'bg-red-600 text-white font-bold border-l-4 border-red-900 shadow-[0_0_16px_rgba(220,38,38,0.55)]'
                  : row.type === 'del'
                  ? 'bg-red-50/70 text-red-900'
                  : row.type === 'add'
                  ? 'bg-red-100/90 text-red-950 font-semibold'
                  : isPatchedSafe && row.content.startsWith('+')
                  ? 'bg-emerald-50/90 text-emerald-900 font-semibold'
                  : 'bg-white text-slate-600';

                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-[26px_68px_1fr] items-baseline px-2 py-1 transition-all duration-300 ${bgClass}`}
                  >
                    <span
                      className={`text-[9px] select-none ${
                        isCrimsonRow && row.type === 'add'
                          ? 'text-red-200'
                          : 'text-slate-400'
                      }`}
                    >
                      {row.lineNo}
                    </span>
                    <span
                      className={`text-[9px] select-none ${
                        isCrimsonRow && row.type === 'add'
                          ? 'text-red-200'
                          : 'text-slate-400'
                      }`}
                    >
                      {row.offset}
                    </span>
                    <span className="break-all">{row.content}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="p-2.5 text-[10px] leading-relaxed text-slate-800 whitespace-pre-wrap">
              {reaAnalysis.v2_bms_step_asm}
            </pre>
          )}
        </div>
      </div>

      {/* BOTTOM SUB-PANEL: GEMINI SAFETY AGENT — ISO 26262 / JEITA VERDICT */}
      <div className="flex flex-col shrink-0 bg-white">
        {/* Compact Gray Panel Header Bar */}
        <div className="h-7 bg-slate-50 border-b border-slate-200 px-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            {isPatchedSafe ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
            )}
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700">
              GEMINI SAFETY AGENT — ISO 26262 / JEITA VERDICT
            </span>
          </div>
        </div>

        <div className="p-3 flex flex-col gap-2.5">
          {/* Structured Engineering Readout Table */}
          <div className="border border-slate-200 rounded bg-slate-50/60 divide-y divide-slate-200 font-mono text-[10.5px]">
            <div className="px-2.5 py-1.5 flex items-center justify-between">
              <span className="text-slate-500 uppercase text-[9.5px] font-bold">
                Gate Status
              </span>
              <span
                className={`font-bold ${
                  isPatchedSafe ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {isPatchedSafe
                  ? 'APPROVED — ALL ASIL-D GATES PASSED'
                  : 'BLOCKED — CRITICAL SAFETY REGRESSION'}
              </span>
            </div>

            <div className="px-2.5 py-1.5 flex items-center justify-between">
              <span className="text-slate-500 uppercase text-[9.5px] font-bold">
                Standard Violated
              </span>
              <span className="font-semibold text-slate-900">
                {isPatchedSafe
                  ? 'None (Compliant)'
                  : activeModelDomain === 'adas'
                  ? 'ISO 26262 ASIL-D / UN R152 AEB'
                  : 'JEITA Li-Ion Spec / IEC 62660-2'}
              </span>
            </div>

            <div className="px-2.5 py-1.5 flex items-center justify-between tabular-nums">
              <span className="text-slate-500 uppercase text-[9.5px] font-bold">
                Active Case Telemetry
              </span>
              <span
                className={`font-bold ${
                  activeModelDomain === 'adas'
                    ? isAdasWorse
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                    : isBmsBlocked
                    ? 'text-red-700'
                    : 'text-emerald-700'
                }`}
              >
                {activeModelDomain === 'adas'
                  ? `Min Gap: ${adasRun.baseline.metrics.min_gap_m?.toFixed(2)}m ➔ ${adasRun.candidate.metrics.min_gap_m?.toFixed(2)}m`
                  : `Peak: ${bmsScenarioEntry.v1_baseline.summary.max_current_a.toFixed(2)}A ➔ ${bmsScenarioEntry.v2_candidate.summary.max_current_a.toFixed(2)}A | ${bmsScenarioEntry.v2_candidate.summary.max_temp_c.toFixed(1)}°C`}
              </span>
            </div>
          </div>

          {/* Deceptive Metric Caught Box */}
          <div
            className={`rounded border p-2.5 flex flex-col gap-1 ${
              isPatchedSafe
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide">
              <AlertTriangle
                className={`w-3.5 h-3.5 shrink-0 ${
                  isPatchedSafe ? 'text-emerald-600' : 'text-amber-600'
                }`}
              />
              <span>
                {isPatchedSafe
                  ? 'Remediation Verified in SIL Digital Twin'
                  : 'Deceptive Metric Caught (Why QA Passed It)'}
              </span>
            </div>
            <p className="text-[11px] leading-snug text-slate-700">
              {isPatchedSafe ? (
                <>
                  Restored <code className="font-mono font-bold">0.8125A</code> JEITA cold
                  derating, <code className="font-mono font-bold">45.0°C</code> thermal
                  cutoff, and <code className="font-mono font-bold">2.0s</code> AEB TTC
                  margin across all 17 test cases.
                </>
              ) : activeModelDomain === 'adas' ? (
                <>
                  AEB trigger dropped <code className="font-mono font-bold">2.0s ➔ 1.0s</code>{' '}
                  for smoother ride feel; passes dry-road QA, but cuts emergency stopping gap
                  by{' '}
                  <strong className="font-mono text-red-700">
                    {adasRun.comparison.evidence.minimum_gap_decreased_m?.toFixed(2) ??
                      '-3.88'}
                    m
                  </strong>
                  .
                </>
              ) : (
                <>
                  Charge time dropped <strong>43.7%</strong> (
                  <code className="font-mono font-bold">10,790s ➔ 6,070s</code>), looking like
                  an optimization, but <code className="font-mono font-bold">1.625A</code> at{' '}
                  <code className="font-mono font-bold">5°C</code> causes permanent anode
                  lithium plating.
                </>
              )}
            </p>
          </div>

          {/* 1-Click Patch / Restore Action Button */}
          {!isPatchedSafe ? (
            <button
              onClick={onOpenPatchModal}
              disabled={isPatching}
              className="h-8 w-full rounded bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Generate Safe Firmware Patch (v2.0.1)</span>
            </button>
          ) : (
            <button
              onClick={onRestoreRegressions}
              disabled={isPatching}
              className="h-8 w-full rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-display font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Broken v2.0.0 Supplier Firmware</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
