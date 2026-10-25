import React, { useState } from 'react';
import {
  AdasComparisonRun,
  AdasUpdatePackage,
  sampleTraceAt,
} from '../engine/adasSimEngine';
import { ScenarioComparisonEntry } from '../types/deltaguard';
import {
  GitCommit,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ArrowRight,
} from 'lucide-react';

interface SimulinkBlockDiagramViewProps {
  adasRun: AdasComparisonRun;
  baselinePkg: AdasUpdatePackage;
  candidatePkg: AdasUpdatePackage;
  bmsScenarioEntry: ScenarioComparisonEntry;
  playbackTimeS: number;
  onChangePlaybackTimeS: (t: number) => void;
  onOpenScopes: () => void;
  onOpenBinaryDiff: () => void;
}

export const SimulinkBlockDiagramView: React.FC<SimulinkBlockDiagramViewProps> = ({
  adasRun,
  baselinePkg,
  candidatePkg,
  bmsScenarioEntry,
  playbackTimeS,
  onChangePlaybackTimeS,
  onOpenScopes,
  onOpenBinaryDiff,
}) => {
  const [diagramMode, setDiagramMode] = useState<'adas' | 'bms'>('adas');

  const baseFrame = sampleTraceAt(adasRun.baseline, playbackTimeS);
  const candFrame = sampleTraceAt(adasRun.candidate, playbackTimeS);

  const bmsMaxIdx = Math.max(0, bmsScenarioEntry.v1_baseline.telemetry.t.length - 1);
  const bmsIdx = Math.min(bmsMaxIdx, Math.max(0, Math.round(playbackTimeS)));

  const v1Bms = {
    i: bmsScenarioEntry.v1_baseline.telemetry.current_a[bmsIdx] ?? 0,
    v: bmsScenarioEntry.v1_baseline.telemetry.voltage_v[bmsIdx] ?? 0,
    temp: bmsScenarioEntry.v1_baseline.telemetry.temp_c[bmsIdx] ?? 25,
    soc: bmsScenarioEntry.v1_baseline.telemetry.soc_pct[bmsIdx] ?? 0,
    contactor: bmsScenarioEntry.v1_baseline.telemetry.contactor_state[bmsIdx] ?? 0,
    plating: bmsScenarioEntry.v1_baseline.telemetry.plating_risk_pct[bmsIdx] ?? 0,
  };

  const v2Bms = {
    i: bmsScenarioEntry.v2_candidate.telemetry.current_a[bmsIdx] ?? 0,
    v: bmsScenarioEntry.v2_candidate.telemetry.voltage_v[bmsIdx] ?? 0,
    temp: bmsScenarioEntry.v2_candidate.telemetry.temp_c[bmsIdx] ?? 25,
    soc: bmsScenarioEntry.v2_candidate.telemetry.soc_pct[bmsIdx] ?? 0,
    contactor: bmsScenarioEntry.v2_candidate.telemetry.contactor_state[bmsIdx] ?? 0,
    plating: bmsScenarioEntry.v2_candidate.telemetry.plating_risk_pct[bmsIdx] ?? 0,
  };

  const maxTime =
    diagramMode === 'adas'
      ? adasRun.durationS
      : bmsScenarioEntry.scenario.duration_s;

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Top Simulink Model Bar */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <GitCommit className="w-4 h-4 text-[#2563EB]" />
            <h1 className="font-display font-bold text-base text-[#0F172A]">
              Simulink Closed-Loop Architecture & Signal Bus Inspector
            </h1>
          </div>
          <p className="text-xs text-[#475569]">
            Inspect live signal propagation across Plant, Sensor, Controller Subsystems, and Safety Comparators at each simulation step.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded border border-[#E2E8F0]">
            <button
              onClick={() => setDiagramMode('adas')}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap ${
                diagramMode === 'adas'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              ADAS Longitudinal Model (ACC/AEB)
            </button>
            <button
              onClick={() => setDiagramMode('bms')}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap ${
                diagramMode === 'bms'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              BMS Electrochemical SIL Model (NCR18650B)
            </button>
          </div>

          <button
            onClick={onOpenScopes}
            className="px-3 py-1.5 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>Open Simulink Scopes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Time Scrubber Bar for Live Signal Probe */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <Sliders className="w-4 h-4 text-[#2563EB]" />
          <span className="font-display font-semibold text-xs text-[#0F172A]">
            Signal Probe Time Step:
          </span>
          <span className="font-mono text-xs font-bold text-[#2563EB] tabular-nums">
            t = {Math.min(playbackTimeS, maxTime).toFixed(2)} s / {maxTime.toFixed(2)} s
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={maxTime}
          step={diagramMode === 'adas' ? 0.02 : 1}
          value={Math.min(playbackTimeS, maxTime)}
          onChange={(e) => onChangePlaybackTimeS(Number(e.target.value))}
          className="w-full accent-[#2563EB] cursor-pointer h-1.5 bg-[#E2E8F0] rounded"
        />

        <span className="font-mono text-xs text-[#64748B] shrink-0">
          {diagramMode === 'adas' ? 'Fixed Step Δt = 0.02s' : 'Fixed Step Δt = 1.00s'}
        </span>
      </div>

      {/* Simulink Canvas Area */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-5 overflow-x-auto">
        {diagramMode === 'adas' ? (
          <div className="min-w-[920px] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <div className="font-mono text-xs text-[#0F172A] font-semibold">
                SUBSYSTEM: <span className="text-[#2563EB]">DeltaGuard_ADAS_TwinTrack_Comparison.slx</span> · Scenario: {adasRun.scenario.label} (μ = {adasRun.scenario.friction})
              </div>
              <div className="font-mono text-xs text-[#64748B]">
                Seed: {adasRun.scenario.seed} · Max Decel Limit: {(adasRun.scenario.friction * 9.81).toFixed(2)} m/s²
              </div>
            </div>

            <svg
              viewBox="0 0 980 420"
              className="w-full h-auto bg-[#F8FAFC] border border-[#E2E8F0] rounded select-none"
            >
              <defs>
                <marker
                  id="arrowBlue"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#2563EB" />
                </marker>
                <marker
                  id="arrowRed"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#DC2626" />
                </marker>
                <marker
                  id="arrowSlate"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#475569" />
                </marker>
              </defs>

              {/* Block 1: Scenario & Traffic Environment Generator */}
              <rect
                x="24"
                y="135"
                width="175"
                height="140"
                rx="4"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <rect
                x="24"
                y="135"
                width="175"
                height="26"
                fill="#F1F5F9"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <text
                x="111"
                y="152"
                textAnchor="middle"
                className="fill-[#0F172A] font-display text-[11px] font-bold"
              >
                1. SCENARIO &amp; TRAFFIC
              </text>
              <text x="36" y="180" className="fill-[#475569] font-mono text-[10px]">
                id: {adasRun.scenario.id}
              </text>
              <text x="36" y="198" className="fill-[#0F172A] font-mono text-[10px] font-semibold">
                μ_road = {adasRun.scenario.friction.toFixed(2)}
              </text>
              <text x="36" y="216" className="fill-[#475569] font-mono text-[10px]">
                v_lead ={' '}
                {baseFrame.ground_truth_target
                  ? `${baseFrame.ground_truth_target.speed_mps.toFixed(1)} m/s`
                  : 'None'}
              </text>
              <text x="36" y="234" className="fill-[#475569] font-mono text-[10px]">
                Sensor Valid:{' '}
                <tspan
                  fill={baseFrame.sensor.valid ? '#16A34A' : '#DC2626'}
                  fontWeight="bold"
                >
                  {baseFrame.sensor.valid ? 'TRUE' : 'DROPOUT'}
                </tspan>
              </text>

              {/* Signal Wires from Scenario to Baseline & Candidate Controllers */}
              <path
                d="M199,180 L250,180 L250,95 L295,95"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2"
                markerEnd="url(#arrowBlue)"
              />
              <path
                d="M199,230 L250,230 L250,310 L295,310"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeDasharray="5 3"
                markerEnd="url(#arrowRed)"
              />

              {/* Top Branch: Baseline v1.0.0 Controller Block */}
              <rect
                x="300"
                y="32"
                width="250"
                height="135"
                rx="4"
                fill="#FFFFFF"
                stroke="#2563EB"
                strokeWidth="2"
              />
              <rect
                x="300"
                y="32"
                width="250"
                height="26"
                fill="#EFF6FF"
                stroke="#2563EB"
                strokeWidth="1.5"
              />
              <text
                x="425"
                y="49"
                textAnchor="middle"
                className="fill-[#1D4ED8] font-mono text-[11px] font-bold"
              >
                2A. BASELINE CONTROLLER (v{baselinePkg.version})
              </text>
              <text x="314" y="76" className="fill-[#0F172A] font-mono text-[10.5px] font-bold">
                aeb_ttc_s = {baselinePkg.params.aeb_ttc_s.toFixed(2)} s
              </text>
              <text x="314" y="95" className="fill-[#475569] font-mono text-[10px]">
                headway = {baselinePkg.params.time_headway_s}s · gap_0 = {baselinePkg.params.standstill_gap_m}m
              </text>
              <text x="314" y="114" className="fill-[#0F172A] font-mono text-[10.5px]">
                Measured TTC:{' '}
                <tspan fill="#2563EB" fontWeight="bold">
                  {baseFrame.controller.ttc_s !== null
                    ? `${baseFrame.controller.ttc_s.toFixed(2)} s`
                    : '∞'}
                </tspan>
              </text>
              <text x="314" y="133" className="fill-[#0F172A] font-mono text-[10.5px]">
                Active Mode:{' '}
                <tspan fill="#1D4ED8" fontWeight="bold">
                  {baseFrame.controller.mode}
                </tspan>
              </text>
              <text x="314" y="152" className="fill-[#475569] font-mono text-[10px]">
                u_cmd = {baseFrame.controller.target_accel_mps2.toFixed(2)} m/s²
              </text>

              {/* Bottom Branch: Candidate v2.0.0 Controller Block */}
              <rect
                x="300"
                y="242"
                width="250"
                height="135"
                rx="4"
                fill="#FFFFFF"
                stroke="#DC2626"
                strokeWidth="2"
              />
              <rect
                x="300"
                y="242"
                width="250"
                height="26"
                fill="#FEF2F2"
                stroke="#DC2626"
                strokeWidth="1.5"
              />
              <text
                x="425"
                y="259"
                textAnchor="middle"
                className="fill-[#DC2626] font-mono text-[11px] font-bold"
              >
                2B. CANDIDATE CONTROLLER (v{candidatePkg.version})
              </text>
              <text x="314" y="286" className="fill-[#DC2626] font-mono text-[10.5px] font-bold">
                aeb_ttc_s = {candidatePkg.params.aeb_ttc_s.toFixed(2)} s (WEAKENED)
              </text>
              <text x="314" y="305" className="fill-[#475569] font-mono text-[10px]">
                headway = {candidatePkg.params.time_headway_s}s · gap_0 = {candidatePkg.params.standstill_gap_m}m
              </text>
              <text x="314" y="324" className="fill-[#0F172A] font-mono text-[10.5px]">
                Measured TTC:{' '}
                <tspan fill="#DC2626" fontWeight="bold">
                  {candFrame.controller.ttc_s !== null
                    ? `${candFrame.controller.ttc_s.toFixed(2)} s`
                    : '∞'}
                </tspan>
              </text>
              <text x="314" y="343" className="fill-[#0F172A] font-mono text-[10.5px]">
                Active Mode:{' '}
                <tspan fill="#DC2626" fontWeight="bold">
                  {candFrame.controller.mode}
                </tspan>
              </text>
              <text x="314" y="362" className="fill-[#475569] font-mono text-[10px]">
                u_cmd = {candFrame.controller.target_accel_mps2.toFixed(2)} m/s²
              </text>

              {/* Wires from Controllers to Vehicle Dynamics Plants */}
              <line
                x1="550"
                y1="98"
                x2="625"
                y2="98"
                stroke="#2563EB"
                strokeWidth="2"
                markerEnd="url(#arrowBlue)"
              />
              <line
                x1="550"
                y1="310"
                x2="625"
                y2="310"
                stroke="#DC2626"
                strokeWidth="2"
                strokeDasharray="5 3"
                markerEnd="url(#arrowRed)"
              />

              {/* Top Plant: Baseline Ego Dynamics */}
              <rect
                x="630"
                y="42"
                width="180"
                height="115"
                rx="4"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <text
                x="720"
                y="64"
                textAnchor="middle"
                className="fill-[#0F172A] font-display text-[11px] font-bold"
              >
                3A. EGO PLANT (v1)
              </text>
              <text x="644" y="88" className="fill-[#2563EB] font-mono text-[11px] font-bold">
                v = {(baseFrame.ego.speed_mps * 3.6).toFixed(1)} km/h
              </text>
              <text x="644" y="108" className="fill-[#0F172A] font-mono text-[10.5px]">
                gap ={' '}
                {baseFrame.ground_truth_target
                  ? `${baseFrame.ground_truth_target.gap_m.toFixed(2)} m`
                  : '--'}
              </text>
              <text x="644" y="128" className="fill-[#475569] font-mono text-[10px]">
                x = {baseFrame.ego.position_m.toFixed(1)} m
              </text>
              <text x="644" y="145" className="fill-[#16A34A] font-mono text-[10px] font-bold">
                Min Gap: {adasRun.baseline.metrics.min_gap_m?.toFixed(2) ?? '--'} m
              </text>

              {/* Bottom Plant: Candidate Ego Dynamics */}
              <rect
                x="630"
                y="252"
                width="180"
                height="115"
                rx="4"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <text
                x="720"
                y="274"
                textAnchor="middle"
                className="fill-[#0F172A] font-display text-[11px] font-bold"
              >
                3B. EGO PLANT (v2)
              </text>
              <text x="644" y="298" className="fill-[#DC2626] font-mono text-[11px] font-bold">
                v = {(candFrame.ego.speed_mps * 3.6).toFixed(1)} km/h
              </text>
              <text x="644" y="318" className="fill-[#0F172A] font-mono text-[10.5px]">
                gap ={' '}
                {candFrame.ground_truth_target
                  ? `${candFrame.ground_truth_target.gap_m.toFixed(2)} m`
                  : '--'}
              </text>
              <text x="644" y="338" className="fill-[#475569] font-mono text-[10px]">
                x = {candFrame.ego.position_m.toFixed(1)} m
              </text>
              <text x="644" y="355" className="fill-[#DC2626] font-mono text-[10px] font-bold">
                Min Gap: {adasRun.candidate.metrics.min_gap_m?.toFixed(2) ?? '--'} m
              </text>

              {/* Comparator Block */}
              <path
                d="M810,98 L845,98 L845,175 L865,175"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2"
                markerEnd="url(#arrowBlue)"
              />
              <path
                d="M810,310 L845,310 L845,235 L865,235"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeDasharray="5 3"
                markerEnd="url(#arrowRed)"
              />

              <rect
                x="870"
                y="145"
                width="92"
                height="120"
                rx="4"
                fill={adasRun.comparison.v2_worse_on_safety ? '#FEF2F2' : '#F0FDF4'}
                stroke={adasRun.comparison.v2_worse_on_safety ? '#DC2626' : '#16A34A'}
                strokeWidth="2"
              />
              <text
                x="916"
                y="175"
                textAnchor="middle"
                className="fill-[#0F172A] font-display text-[10px] font-bold"
              >
                GATE VERDICT
              </text>
              <text
                x="916"
                y="202"
                textAnchor="middle"
                fill={adasRun.comparison.v2_worse_on_safety ? '#DC2626' : '#16A34A'}
                className="font-mono text-[11px] font-bold"
              >
                {adasRun.comparison.v2_worse_on_safety ? 'REGRESSION' : 'VERIFIED'}
              </text>
              <text
                x="916"
                y="224"
                textAnchor="middle"
                className="fill-[#475569] font-mono text-[9.5px]"
              >
                ΔGap:{' '}
                {adasRun.comparison.evidence.minimum_gap_decreased_m?.toFixed(2) ?? '0.00'}m
              </text>
              <text
                x="916"
                y="242"
                textAnchor="middle"
                className="fill-[#475569] font-mono text-[9.5px]"
              >
                ΔTTC:{' '}
                {adasRun.comparison.evidence.minimum_ttc_decreased_s?.toFixed(2) ?? '0.00'}s
              </text>
            </svg>
          </div>
        ) : (
          <div className="min-w-[920px] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <div className="font-mono text-xs text-[#0F172A] font-semibold">
                SUBSYSTEM: <span className="text-[#2563EB]">DeltaGuard_NCR18650B_SIL_Homologation.slx</span> · Scenario: {bmsScenarioEntry.scenario.id} ({bmsScenarioEntry.scenario.name})
              </div>
              <button
                onClick={onOpenBinaryDiff}
                className="font-mono text-xs text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Inspect Compiled ELF64 x86-64 Disassembly →</span>
              </button>
            </div>

            <svg
              viewBox="0 0 980 420"
              className="w-full h-auto bg-[#F8FAFC] border border-[#E2E8F0] rounded select-none"
            >
              {/* Block 1: NCR18650B Boundary Inputs */}
              <rect
                x="24"
                y="135"
                width="180"
                height="145"
                rx="4"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <rect
                x="24"
                y="135"
                width="180"
                height="26"
                fill="#F1F5F9"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <text
                x="114"
                y="152"
                textAnchor="middle"
                className="fill-[#0F172A] font-display text-[11px] font-bold"
              >
                1. CELL &amp; NTC INPUT BUS
              </text>
              <text x="36" y="180" className="fill-[#0F172A] font-mono text-[10px] font-semibold">
                T_ambient = {bmsScenarioEntry.scenario.ambient_temp_c.toFixed(1)} °C
              </text>
              <text x="36" y="198" className="fill-[#475569] font-mono text-[10px]">
                I_request = {bmsScenarioEntry.scenario.requested_current_a.toFixed(3)} A
              </text>
              <text x="36" y="216" className="fill-[#475569] font-mono text-[10px]">
                SoC_init = {(bmsScenarioEntry.scenario.initial_soc * 100).toFixed(0)}%
              </text>
              <text x="36" y="236" className="fill-[#0F172A] font-mono text-[10px]">
                NTC Fault:{' '}
                <tspan
                  fill={
                    bmsScenarioEntry.scenario.temp_sensor_fail_at_s >= 0 &&
                    playbackTimeS >= bmsScenarioEntry.scenario.temp_sensor_fail_at_s
                      ? '#DC2626'
                      : '#16A34A'
                  }
                  fontWeight="bold"
                >
                  {bmsScenarioEntry.scenario.temp_sensor_fail_at_s >= 0 &&
                  playbackTimeS >= bmsScenarioEntry.scenario.temp_sensor_fail_at_s
                    ? 'FAIL (1)'
                    : 'OK (0)'}
                </tspan>
              </text>

              {/* Wires to C Shared Libraries */}
              <path
                d="M204,180 L255,180 L255,95 L295,95"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2"
              />
              <path
                d="M204,230 L255,230 L255,310 L295,310"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeDasharray="5 3"
              />

              {/* Block 2A: bms_v1.so */}
              <rect
                x="300"
                y="28"
                width="265"
                height="140"
                rx="4"
                fill="#FFFFFF"
                stroke="#2563EB"
                strokeWidth="2"
              />
              <rect
                x="300"
                y="28"
                width="265"
                height="26"
                fill="#EFF6FF"
                stroke="#2563EB"
                strokeWidth="1.5"
              />
              <text
                x="432"
                y="45"
                textAnchor="middle"
                className="fill-[#1D4ED8] font-mono text-[11px] font-bold"
              >
                2A. ctypes.CDLL(&quot;firmware/bms_v1.so&quot;)
              </text>
              <text x="314" y="74" className="fill-[#0F172A] font-mono text-[10px] font-semibold">
                .rodata MAX_TEMP = 45.0f (0x42340000)
              </text>
              <text x="314" y="92" className="fill-[#0F172A] font-mono text-[10px]">
                JEITA &lt;10.0°C Limit = 0.8125A (0.25C)
              </text>
              <text x="314" y="110" className="fill-[#16A34A] font-mono text-[10px] font-semibold">
                NTC Fault Gate: Immediate 1-Tick Open
              </text>
              <text x="314" y="132" className="fill-[#2563EB] font-mono text-[11px] font-bold">
                I_cmd(t) = {v1Bms.i.toFixed(4)} A
              </text>
              <text x="314" y="152" className="fill-[#475569] font-mono text-[10px]">
                Contactor: {v1Bms.contactor === 1 ? 'OPEN (0x01)' : 'CLOSED (0x00)'}
              </text>

              {/* Block 2B: bms_v2.so */}
              <rect
                x="300"
                y="242"
                width="265"
                height="140"
                rx="4"
                fill="#FFFFFF"
                stroke="#DC2626"
                strokeWidth="2"
              />
              <rect
                x="300"
                y="242"
                width="265"
                height="26"
                fill="#FEF2F2"
                stroke="#DC2626"
                strokeWidth="1.5"
              />
              <text
                x="432"
                y="259"
                textAnchor="middle"
                className="fill-[#DC2626] font-mono text-[11px] font-bold"
              >
                2B. ctypes.CDLL(&quot;firmware/bms_v2.so&quot;)
              </text>
              <text x="314" y="288" className="fill-[#DC2626] font-mono text-[10px] font-bold">
                .rodata MAX_TEMP = 50.0f (0x42480000)
              </text>
              <text x="314" y="306" className="fill-[#DC2626] font-mono text-[10px] font-semibold">
                JEITA &lt;10.0°C Branch: REMOVED (1.625A)
              </text>
              <text x="314" y="324" className="fill-[#DC2626] font-mono text-[10px] font-semibold">
                NTC Fault Gate: Gated by SoC &gt;= 0.80
              </text>
              <text x="314" y="346" className="fill-[#DC2626] font-mono text-[11px] font-bold">
                I_cmd(t) = {v2Bms.i.toFixed(4)} A
              </text>
              <text x="314" y="366" className="fill-[#475569] font-mono text-[10px]">
                Contactor: {v2Bms.contactor === 1 ? 'OPEN (0x01)' : 'CLOSED (0x00)'}
              </text>

              {/* Wires to Electrochemical Cell Plants */}
              <line
                x1="565"
                y1="98"
                x2="635"
                y2="98"
                stroke="#2563EB"
                strokeWidth="2"
              />
              <line
                x1="565"
                y1="310"
                x2="635"
                y2="310"
                stroke="#DC2626"
                strokeWidth="2"
                strokeDasharray="5 3"
              />

              {/* Block 3A: NCR18650B Plant v1 */}
              <rect
                x="640"
                y="38"
                width="185"
                height="120"
                rx="4"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <text
                x="732"
                y="60"
                textAnchor="middle"
                className="fill-[#0F172A] font-display text-[11px] font-bold"
              >
                3A. NCR18650B PLANT (v1)
              </text>
              <text x="652" y="84" className="fill-[#2563EB] font-mono text-[10.5px] font-bold">
                V_term = {v1Bms.v.toFixed(3)} V
              </text>
              <text x="652" y="104" className="fill-[#0F172A] font-mono text-[10.5px]">
                T_core = {v1Bms.temp.toFixed(2)} °C
              </text>
              <text x="652" y="124" className="fill-[#0F172A] font-mono text-[10.5px]">
                SoC = {v1Bms.soc.toFixed(1)} %
              </text>
              <text x="652" y="144" className="fill-[#16A34A] font-mono text-[10px] font-bold">
                Plating Risk: {v1Bms.plating.toFixed(1)}%
              </text>

              {/* Block 3B: NCR18650B Plant v2 */}
              <rect
                x="640"
                y="250"
                width="185"
                height="120"
                rx="4"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <text
                x="732"
                y="272"
                textAnchor="middle"
                className="fill-[#0F172A] font-display text-[11px] font-bold"
              >
                3B. NCR18650B PLANT (v2)
              </text>
              <text x="652" y="296" className="fill-[#DC2626] font-mono text-[10.5px] font-bold">
                V_term = {v2Bms.v.toFixed(3)} V
              </text>
              <text x="652" y="316" className="fill-[#0F172A] font-mono text-[10.5px]">
                T_core = {v2Bms.temp.toFixed(2)} °C
              </text>
              <text x="652" y="336" className="fill-[#0F172A] font-mono text-[10.5px]">
                SoC = {v2Bms.soc.toFixed(1)} %
              </text>
              <text x="652" y="356" className="fill-[#DC2626] font-mono text-[10px] font-bold">
                Plating Risk: {v2Bms.plating.toFixed(1)}%
              </text>

              {/* Block 4: ASIL-D Homologation Gate */}
              <path
                d="M825,98 L850,98 L850,175 L868,175"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2"
              />
              <path
                d="M825,310 L850,310 L850,235 L868,235"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeDasharray="5 3"
              />

              <rect
                x="870"
                y="145"
                width="94"
                height="120"
                rx="4"
                fill={
                  bmsScenarioEntry.homologation_gate.deltaguard_verdict.includes('BLOCKED')
                    ? '#FEF2F2'
                    : '#F0FDF4'
                }
                stroke={
                  bmsScenarioEntry.homologation_gate.deltaguard_verdict.includes('BLOCKED')
                    ? '#DC2626'
                    : '#16A34A'
                }
                strokeWidth="2"
              />
              <text
                x="917"
                y="175"
                textAnchor="middle"
                className="fill-[#0F172A] font-display text-[10px] font-bold"
              >
                ASIL-D GATE
              </text>
              <text
                x="917"
                y="202"
                textAnchor="middle"
                fill={
                  bmsScenarioEntry.homologation_gate.deltaguard_verdict.includes('BLOCKED')
                    ? '#DC2626'
                    : '#16A34A'
                }
                className="font-mono text-[11px] font-bold"
              >
                {bmsScenarioEntry.homologation_gate.deltaguard_verdict.includes('BLOCKED')
                  ? 'BLOCKED'
                  : 'APPROVED'}
              </text>
              <text
                x="917"
                y="225"
                textAnchor="middle"
                className="fill-[#475569] font-mono text-[9px]"
              >
                Naive QA: PASS
              </text>
              <text
                x="917"
                y="242"
                textAnchor="middle"
                className="fill-[#DC2626] font-mono text-[9.5px] font-semibold"
              >
                {bmsScenarioEntry.homologation_gate.violations.length} Violations
              </text>
            </svg>
          </div>
        )}
      </div>

      {/* Bottom Parameter Diff & Safety Summary Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-display font-bold text-xs uppercase tracking-wider text-[#0F172A]">
            {diagramMode === 'adas'
              ? 'ADAS Controller Parameter Diff & Safety Evidence'
              : 'BMS Homologation Violations & Binary Root Causes'}
          </span>
          <span className="font-mono text-xs text-[#64748B]">
            Deterministic Identical Inputs Verified
          </span>
        </div>

        {diagramMode === 'adas' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs tabular-nums">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3">
              <span className="text-[#64748B] block text-[10px] uppercase">
                Parameter Modification
              </span>
              <span className="text-[#0F172A] font-bold mt-1 block">
                {adasRun.comparison.parameter_differences.length > 0
                  ? adasRun.comparison.parameter_differences
                      .map((d) => `${d.field}: ${d.v1_value} → ${d.v2_value}`)
                      .join(' · ')
                  : 'No parameter differences'}
              </span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3">
              <span className="text-[#64748B] block text-[10px] uppercase">
                Minimum Gap &amp; TTC Margin Shift
              </span>
              <span className="text-[#D97706] font-bold mt-1 block">
                Δ Min Gap:{' '}
                {adasRun.comparison.evidence.minimum_gap_decreased_m?.toFixed(2) ?? '0.00'} m ·
                Δ Min TTC:{' '}
                {adasRun.comparison.evidence.minimum_ttc_decreased_s?.toFixed(2) ?? '0.00'} s
              </span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3 flex items-center justify-between">
              <div>
                <span className="text-[#64748B] block text-[10px] uppercase">
                  Comparison Safety Rule
                </span>
                <span
                  className={`font-bold mt-1 block ${
                    adasRun.comparison.v2_worse_on_safety
                      ? 'text-[#DC2626]'
                      : 'text-[#16A34A]'
                  }`}
                >
                  {adasRun.comparison.v2_worse_on_safety
                    ? 'Candidate Reduced Safety Margin'
                    : 'Safety Margin Preserved'}
                </span>
              </div>
              {adasRun.comparison.v2_worse_on_safety ? (
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3">
              <span className="text-[#64748B] block text-[10px] uppercase">
                JEITA Cold Derating (&lt;10°C)
              </span>
              <span className="text-[#0F172A] font-bold mt-1 block">
                v1: 0.8125 A (0.25C) vs v2: 1.6250 A (0.50C)
              </span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3">
              <span className="text-[#64748B] block text-[10px] uppercase">
                IEC 62660-2 Thermal Cutoff (.rodata)
              </span>
              <span className="text-[#DC2626] font-bold mt-1 block">
                v1: 45.0°C (0x42340000) vs v2: 50.0°C (0x42480000)
              </span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3">
              <span className="text-[#64748B] block text-[10px] uppercase">
                ISO 26262 ASIL-D Thermistor Fault Gate
              </span>
              <span className="text-[#DC2626] font-bold mt-1 block">
                v1: Immediate 1-Tick Open vs v2: Gated by SoC ≥ 80%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
