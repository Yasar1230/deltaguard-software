import React, { useMemo, useState } from 'react';
import {
  ScenarioComparisonEntry,
  HomologationRulebook,
} from '../types/deltaguard';
import { AdasComparisonRun } from '../engine/adasSimEngine';
import {
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ArrowRight,
  Cpu,
  Activity,
} from 'lucide-react';

interface OscilloscopeAndEcuViewProps {
  scopeDomain: 'bms' | 'adas';
  onChangeScopeDomain: (domain: 'bms' | 'adas') => void;
  scenarioEntry: ScenarioComparisonEntry;
  adasRun: AdasComparisonRun;
  rulebook: HomologationRulebook;
  onInspectBinaryDiff: () => void;
}

interface WaveformChannelProps {
  title: string;
  unit: string;
  timeArray: number[];
  v1Data: number[];
  v2Data: number[];
  scrubIndex: number;
  minY: number;
  maxY: number;
  v1Label: string;
  v2Label: string;
  limitLine?: {
    value: number;
    label: string;
    color: string;
  };
  secondaryLimitLine?: {
    value: number;
    label: string;
    color: string;
  };
}

const WaveformChannel: React.FC<WaveformChannelProps> = ({
  title,
  unit,
  timeArray,
  v1Data,
  v2Data,
  scrubIndex,
  minY,
  maxY,
  v1Label,
  v2Label,
  limitLine,
  secondaryLimitLine,
}) => {
  const width = 640;
  const height = 164;
  const padLeft = 54;
  const padRight = 22;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const spanY = Math.max(0.0001, maxY - minY);
  const count = Math.max(1, timeArray.length - 1);

  const toX = (idx: number) => padLeft + (idx / count) * plotW;
  const toY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    return padTop + plotH - ((clamped - minY) / spanY) * plotH;
  };

  const v1Points = useMemo(
    () =>
      v1Data
        .map((val, idx) => `${toX(idx).toFixed(1)},${toY(val).toFixed(1)}`)
        .join(' '),
    [v1Data, minY, maxY, count]
  );

  const v2Points = useMemo(
    () =>
      v2Data
        .map((val, idx) => `${toX(idx).toFixed(1)},${toY(val).toFixed(1)}`)
        .join(' '),
    [v2Data, minY, maxY, count]
  );

  const curV1 = v1Data[scrubIndex] ?? 0;
  const curV2 = v2Data[scrubIndex] ?? 0;
  const curDelta = curV2 - curV1;
  const scrubX = toX(scrubIndex);

  const yTicks = [minY, minY + spanY * 0.5, maxY];

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-col gap-2">
      {/* Row 1: Dedicated Channel Title & External Threshold Reference Legend (Never overlaps values) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xs text-[#0F172A]">
            {title}
          </span>
          <span className="text-[#CBD5E1]">·</span>
          <span className="font-mono text-[11px] text-[#64748B]">[{unit}]</span>
        </div>

        {/* Threshold Reference Legend Outside SVG */}
        <div className="flex items-center gap-3 font-mono text-[10.5px] text-[#475569]">
          {limitLine && (
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-0.5 inline-block"
                style={{ backgroundColor: limitLine.color }}
              />
              <span>{limitLine.label}</span>
            </span>
          )}
          {secondaryLimitLine && (
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-0.5 inline-block"
                style={{ backgroundColor: secondaryLimitLine.color }}
              />
              <span>{secondaryLimitLine.label}</span>
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Dedicated Tabular Readout Bar (Zero Clipping or Merging) */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded px-3 py-1.5 flex items-center justify-between gap-4 font-mono text-xs tabular-nums">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[#2563EB] font-semibold">
            {v1Label}: {curV1.toFixed(3)} {unit}
          </span>
          <span className="text-[#CBD5E1]">·</span>
          <span className="text-[#DC2626] font-bold">
            {v2Label}: {curV2.toFixed(3)} {unit}
          </span>
        </div>
        <span
          className={`font-semibold ${
            Math.abs(curDelta) > 0.01 ? 'text-[#D97706]' : 'text-[#64748B]'
          }`}
        >
          Δ {curDelta >= 0 ? '+' : ''}
          {curDelta.toFixed(3)} {unit}
        </span>
      </div>

      {/* Clean Simulink Scope Plot Area */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[156px] select-none bg-[#F8FAFC] rounded border border-[#E2E8F0]"
      >
        {/* Horizontal Engineering Grid */}
        {yTicks.map((tick, i) => {
          const y = toY(tick);
          return (
            <g key={i}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-[#475569] font-mono text-[10px]"
              >
                {tick.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Vertical Time Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const idx = Math.round(frac * count);
          const x = toX(idx);
          const tVal = timeArray[idx] ?? 0;
          return (
            <g key={i}>
              <line
                x1={x}
                y1={padTop}
                x2={x}
                y2={height - padBottom}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text
                x={x}
                y={height - 7}
                textAnchor="middle"
                className="fill-[#475569] font-mono text-[10px]"
              >
                {tVal.toFixed(1)}s
              </text>
            </g>
          );
        })}

        {/* Clean Reference Threshold Lines (Labels live in Card Header to prevent collision) */}
        {limitLine && limitLine.value >= minY && limitLine.value <= maxY && (
          <line
            x1={padLeft}
            y1={toY(limitLine.value)}
            x2={width - padRight}
            y2={toY(limitLine.value)}
            stroke={limitLine.color}
            strokeWidth="1.25"
            strokeDasharray="4 3"
          />
        )}

        {secondaryLimitLine &&
          secondaryLimitLine.value >= minY &&
          secondaryLimitLine.value <= maxY && (
            <line
              x1={padLeft}
              y1={toY(secondaryLimitLine.value)}
              x2={width - padRight}
              y2={toY(secondaryLimitLine.value)}
              stroke={secondaryLimitLine.color}
              strokeWidth="1.25"
              strokeDasharray="2 3"
            />
          )}

        {/* Baseline Trace (Solid Cobalt Blue) */}
        <polyline
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.2"
          points={v1Points}
        />

        {/* Candidate Trace (Dashed Crimson Red) */}
        <polyline
          fill="none"
          stroke="#DC2626"
          strokeWidth="2.2"
          strokeDasharray="6 3"
          points={v2Points}
        />

        {/* Scrub Cursor Line */}
        <line
          x1={scrubX}
          y1={padTop}
          x2={scrubX}
          y2={height - padBottom}
          stroke="#0F172A"
          strokeWidth="1.2"
        />
        <circle
          cx={scrubX}
          cy={toY(curV1)}
          r="3.5"
          fill="#2563EB"
          stroke="#FFFFFF"
          strokeWidth="1"
        />
        <circle
          cx={scrubX}
          cy={toY(curV2)}
          r="3.5"
          fill="#DC2626"
          stroke="#FFFFFF"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};

export const OscilloscopeAndEcuView: React.FC<OscilloscopeAndEcuViewProps> = ({
  scopeDomain,
  onChangeScopeDomain,
  scenarioEntry,
  adasRun,
  rulebook,
  onInspectBinaryDiff,
}) => {
  const { scenario, v1_baseline, v2_candidate, homologation_gate } = scenarioEntry;

  // BMS arrays
  const bmsTArr = v1_baseline.telemetry.t;
  const bmsMaxIdx = Math.max(0, bmsTArr.length - 1);
  const [bmsScrubIdx, setBmsScrubIdx] = useState<number>(Math.min(15, bmsMaxIdx));
  const safeBmsIdx = Math.min(bmsScrubIdx, bmsMaxIdx);

  // ADAS arrays (align to common length)
  const adasStepCount = Math.min(
    adasRun.baseline.trace.length,
    adasRun.candidate.trace.length
  );
  const adasTArr = useMemo(
    () => adasRun.baseline.trace.slice(0, adasStepCount).map((f) => f.t_s),
    [adasRun, adasStepCount]
  );
  const [adasScrubIdx, setAdasScrubIdx] = useState<number>(
    Math.min(120, Math.max(0, adasStepCount - 1))
  );
  const safeAdasIdx = Math.min(adasScrubIdx, Math.max(0, adasStepCount - 1));

  const adasArrays = useMemo(() => {
    const bTrace = adasRun.baseline.trace.slice(0, adasStepCount);
    const cTrace = adasRun.candidate.trace.slice(0, adasStepCount);
    return {
      v1SpeedKmh: bTrace.map((f) => f.ego.speed_mps * 3.6),
      v2SpeedKmh: cTrace.map((f) => f.ego.speed_mps * 3.6),
      v1GapM: bTrace.map((f) => f.ground_truth_target?.gap_m ?? 0),
      v2GapM: cTrace.map((f) => f.ground_truth_target?.gap_m ?? 0),
      v1TtcS: bTrace.map((f) => Math.min(10, f.controller.ttc_s ?? 10)),
      v2TtcS: cTrace.map((f) => Math.min(10, f.controller.ttc_s ?? 10)),
      v1Accel: bTrace.map((f) => f.ego.acceleration_mps2),
      v2Accel: cTrace.map((f) => f.ego.acceleration_mps2),
    };
  }, [adasRun, adasStepCount]);

  const isBlocked = homologation_gate.deltaguard_verdict.includes('BLOCKED');

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Top Simulink Data Inspector Header & Domain Switcher */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h1 className="font-display font-bold text-base text-[#0F172A]">
              Simulink Data Inspector — Multi-Channel Synchronized Scopes
            </h1>
            <span className="text-[#CBD5E1]">·</span>
            <span className="font-mono text-xs text-[#2563EB] font-bold">
              {scopeDomain === 'bms' ? scenario.id : adasRun.scenario.id}
            </span>
            <span className="text-[#CBD5E1]">·</span>
            <span className="font-sans text-xs font-semibold text-[#475569]">
              {scopeDomain === 'bms' ? scenario.name : adasRun.scenario.label}
            </span>
          </div>
          <p className="text-xs text-[#475569]">
            {scopeDomain === 'bms'
              ? scenario.description
              : `Deterministic 0.02s step comparison · Friction μ=${adasRun.scenario.friction} · Seed=${adasRun.scenario.seed}`}
          </p>
        </div>

        {/* Scope Domain Switcher + Gate Verdict */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded border border-[#E2E8F0]">
            <button
              onClick={() => onChangeScopeDomain('adas')}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap ${
                scopeDomain === 'adas'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              ADAS Vehicle Scopes (Speed, Gap, TTC, Accel)
            </button>
            <button
              onClick={() => onChangeScopeDomain('bms')}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap ${
                scopeDomain === 'bms'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              BMS Cell Scopes (Current, Voltage, Temp, SoC)
            </button>
          </div>

          <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded px-3 py-1.5 font-mono text-xs">
            {(scopeDomain === 'bms'
              ? isBlocked
              : adasRun.comparison.v2_worse_on_safety) ? (
              <>
                <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                <span className="font-bold text-[#DC2626]">
                  {scopeDomain === 'bms'
                    ? homologation_gate.deltaguard_verdict
                    : 'SAFETY MARGIN REDUCED'}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span className="font-bold text-[#16A34A]">VERIFIED PASS</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Synchronized Timeline Scrubber Bar */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md px-4 py-2.5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <Sliders className="w-4 h-4 text-[#2563EB]" />
          <span className="font-display font-semibold text-xs text-[#0F172A]">
            Scope Cursor
          </span>
          <span className="font-mono text-xs font-bold text-[#2563EB] tabular-nums">
            t ={' '}
            {scopeDomain === 'bms'
              ? `${bmsTArr[safeBmsIdx] ?? 0} s / ${scenario.duration_s} s`
              : `${(adasTArr[safeAdasIdx] ?? 0).toFixed(2)} s / ${adasRun.durationS.toFixed(2)} s`}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={scopeDomain === 'bms' ? bmsMaxIdx : Math.max(0, adasStepCount - 1)}
          value={scopeDomain === 'bms' ? safeBmsIdx : safeAdasIdx}
          onChange={(e) =>
            scopeDomain === 'bms'
              ? setBmsScrubIdx(Number(e.target.value))
              : setAdasScrubIdx(Number(e.target.value))
          }
          className="w-full accent-[#2563EB] cursor-pointer h-1.5 bg-[#E2E8F0] rounded-lg"
        />

        <div className="flex items-center gap-4 shrink-0 font-mono text-xs whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#2563EB] inline-block" />
            <span className="text-[#0F172A] font-medium">Baseline v1.0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#DC2626] inline-block" />
            <span className="text-[#0F172A] font-medium">Candidate v2</span>
          </div>
        </div>
      </div>

      {/* 4-Channel Non-Overlapping Scope Grid */}
      {scopeDomain === 'adas' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <WaveformChannel
            title="Scope 1 · Ego Longitudinal Speed v(t)"
            unit="km/h"
            timeArray={adasTArr}
            v1Data={adasArrays.v1SpeedKmh}
            v2Data={adasArrays.v2SpeedKmh}
            scrubIndex={safeAdasIdx}
            minY={0}
            maxY={90}
            v1Label="v1.0.0"
            v2Label="v2.0.0"
          />

          <WaveformChannel
            title="Scope 2 · Bumper-to-Bumper Clearance Gap(t)"
            unit="m"
            timeArray={adasTArr}
            v1Data={adasArrays.v1GapM}
            v2Data={adasArrays.v2GapM}
            scrubIndex={safeAdasIdx}
            minY={0}
            maxY={45}
            v1Label="v1.0.0"
            v2Label="v2.0.0"
            limitLine={{
              value: 5.0,
              label: 'Standstill Gap (5.0m)',
              color: '#D97706',
            }}
          />

          <WaveformChannel
            title="Scope 3 · Time-to-Collision TTC(t)"
            unit="s"
            timeArray={adasTArr}
            v1Data={adasArrays.v1TtcS}
            v2Data={adasArrays.v2TtcS}
            scrubIndex={safeAdasIdx}
            minY={0}
            maxY={10}
            v1Label="v1.0.0"
            v2Label="v2.0.0"
            limitLine={{
              value: 2.0,
              label: 'v1 AEB Trigger (2.0s)',
              color: '#2563EB',
            }}
            secondaryLimitLine={{
              value: 1.0,
              label: 'v2 AEB Trigger (1.0s)',
              color: '#DC2626',
            }}
          />

          <WaveformChannel
            title="Scope 4 · Realized Longitudinal Acceleration a(t)"
            unit="m/s²"
            timeArray={adasTArr}
            v1Data={adasArrays.v1Accel}
            v2Data={adasArrays.v2Accel}
            scrubIndex={safeAdasIdx}
            minY={-10}
            maxY={3}
            v1Label="v1.0.0"
            v2Label="v2.0.0"
            limitLine={{
              value: -adasRun.scenario.friction * 9.81,
              label: `Tire Friction Limit (-${(adasRun.scenario.friction * 9.81).toFixed(1)} m/s²)`,
              color: '#DC2626',
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <WaveformChannel
            title="Scope 1 · Cell Charge/Discharge Current I(t)"
            unit="A"
            timeArray={bmsTArr}
            v1Data={v1_baseline.telemetry.current_a}
            v2Data={v2_candidate.telemetry.current_a}
            scrubIndex={safeBmsIdx}
            minY={Math.min(
              -3.5,
              ...v1_baseline.telemetry.current_a,
              ...v2_candidate.telemetry.current_a
            )}
            maxY={2.0}
            v1Label="bms_v1.so"
            v2Label="bms_v2.so"
            limitLine={{
              value: rulebook.cell_specification.standard_charge_current_a,
              label: '0.5C Std (1.625A)',
              color: '#475569',
            }}
            secondaryLimitLine={{
              value: rulebook.cell_specification.jeita_cold_charge_current_a,
              label: 'JEITA <10°C (0.8125A)',
              color: '#D97706',
            }}
          />

          <WaveformChannel
            title="Scope 2 · Cell Terminal Voltage V_term(t)"
            unit="V"
            timeArray={bmsTArr}
            v1Data={v1_baseline.telemetry.voltage_v}
            v2Data={v2_candidate.telemetry.voltage_v}
            scrubIndex={safeBmsIdx}
            minY={2.8}
            maxY={4.35}
            v1Label="bms_v1.so"
            v2Label="bms_v2.so"
            limitLine={{
              value: rulebook.cell_specification.cv_cutoff_voltage_v,
              label: 'CV Cutoff (4.200V)',
              color: '#DC2626',
            }}
          />

          <WaveformChannel
            title="Scope 3 · Core Cell Temperature T_core(t)"
            unit="°C"
            timeArray={bmsTArr}
            v1Data={v1_baseline.telemetry.temp_c}
            v2Data={v2_candidate.telemetry.temp_c}
            scrubIndex={safeBmsIdx}
            minY={Math.min(
              -12,
              ...v1_baseline.telemetry.temp_c,
              ...v2_candidate.telemetry.temp_c
            )}
            maxY={54}
            v1Label="bms_v1.so"
            v2Label="bms_v2.so"
            limitLine={{
              value: rulebook.cell_specification.hard_thermal_cutoff_c,
              label: 'IEC Cutoff (45.0°C)',
              color: '#DC2626',
            }}
            secondaryLimitLine={{
              value: 10.0,
              label: 'JEITA Cold (10.0°C)',
              color: '#2563EB',
            }}
          />

          <WaveformChannel
            title="Scope 4 · State of Charge SoC(t)"
            unit="%"
            timeArray={bmsTArr}
            v1Data={v1_baseline.telemetry.soc_pct}
            v2Data={v2_candidate.telemetry.soc_pct}
            scrubIndex={safeBmsIdx}
            minY={0}
            maxY={105}
            v1Label="bms_v1.so"
            v2Label="bms_v2.so"
            limitLine={{
              value: 100,
              label: 'Full SoC (100%)',
              color: '#16A34A',
            }}
          />
        </div>
      )}

      {/* Violation Detail Footer when BMS Scenario Fails Homologation */}
      {scopeDomain === 'bms' && homologation_gate.violations.length > 0 && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-md p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#DC2626]" />
              <span className="font-display font-bold text-xs text-[#991B1B] uppercase">
                Correlated ELF64 Machine Code Violations ({scenario.id})
              </span>
            </div>
            <button
              onClick={onInspectBinaryDiff}
              className="px-3 py-1 rounded bg-[#FFFFFF] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5] font-mono text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Inspect x86-64 Disassembly</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {homologation_gate.violations.map((v, i) => (
            <div key={i} className="font-mono text-xs text-[#0F172A]">
              <strong className="text-[#DC2626]">{v.rule_id}:</strong> {v.message}{' '}
              <span className="text-[#475569]">({v.asm_root_cause})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
