import React from 'react';
import { AdasComparisonRun, sampleTraceAt } from '../engine/adasSimEngine';
import { ScenarioComparisonEntry, TelemetryArrays } from '../types/deltaguard';

interface LiveOscilloscopeDockProps {
  activeModelDomain: 'adas' | 'bms';
  adasRun: AdasComparisonRun;
  bmsScenarioEntry: ScenarioComparisonEntry;
  playbackTimeS: number;
  onChangePlaybackTimeS: (t: number) => void;
  onOpenFullScopesModal?: () => void;
  isHighlighted?: boolean;
}

interface ScopeChannelConfig {
  id: string;
  title: string;
  unit: string;
  minY: number;
  maxY: number;
  limitValue?: number;
  limitLabel?: string;
  v1CurrentVal: string;
  v2CurrentVal: string;
  v1Points: Array<{ t: number; y: number }>;
  v2Points: Array<{ t: number; y: number }>;
}

function sampleBmsArraysAt(tel: TelemetryArrays, t: number) {
  const n = tel.t.length;
  if (n === 0) {
    return {
      current_a: 0,
      temp_c: 25,
      soc_pct: 0,
      contactor_state: 0,
      plating_risk_pct: 0,
    };
  }
  let idx = n - 1;
  for (let i = n - 1; i >= 0; i--) {
    if (tel.t[i] <= t) {
      idx = i;
      break;
    }
  }
  return {
    current_a: tel.current_a[idx] ?? 0,
    temp_c: tel.temp_c[idx] ?? 25,
    soc_pct: tel.soc_pct[idx] ?? 0,
    contactor_state: tel.contactor_state[idx] ?? 0,
    plating_risk_pct: tel.plating_risk_pct[idx] ?? 0,
  };
}

export const LiveOscilloscopeDock: React.FC<LiveOscilloscopeDockProps> = ({
  activeModelDomain,
  adasRun,
  bmsScenarioEntry,
  playbackTimeS,
  onChangePlaybackTimeS,
  isHighlighted = false,
}) => {
  const durationS =
    activeModelDomain === 'adas'
      ? adasRun.scenario.duration_s
      : Math.max(
          bmsScenarioEntry.scenario.duration_s,
          bmsScenarioEntry.v1_baseline.summary.charge_time_s,
          bmsScenarioEntry.v2_candidate.summary.charge_time_s,
          60
        );

  const clampedTimeS = Math.min(Math.max(playbackTimeS, 0), durationS);

  let channels: ScopeChannelConfig[] = [];

  if (activeModelDomain === 'adas') {
    const bTrace = adasRun.baseline.trace;
    const cTrace = adasRun.candidate.trace;
    const bSnap = sampleTraceAt(adasRun.baseline, clampedTimeS);
    const cSnap = sampleTraceAt(adasRun.candidate, clampedTimeS);

    channels = [
      {
        id: 'ch1_vel',
        title: 'CH1: EGO VELOCITY (KM/H)',
        unit: 'km/h',
        minY: 0,
        maxY: 95,
        limitValue: adasRun.scenario.ego.speed_mps * 3.6,
        limitLabel: `Init ${(adasRun.scenario.ego.speed_mps * 3.6).toFixed(0)} km/h`,
        v1CurrentVal: `${((bSnap?.ego.speed_mps ?? 0) * 3.6).toFixed(1)} km/h`,
        v2CurrentVal: `${((cSnap?.ego.speed_mps ?? 0) * 3.6).toFixed(1)} km/h`,
        v1Points: bTrace.map((pt) => ({ t: pt.t_s, y: pt.ego.speed_mps * 3.6 })),
        v2Points: cTrace.map((pt) => ({ t: pt.t_s, y: pt.ego.speed_mps * 3.6 })),
      },
      {
        id: 'ch2_gap',
        title: 'CH2: STOPPING GAP CLEARANCE (M)',
        unit: 'm',
        minY: 0,
        maxY: 45,
        limitValue: 5.0,
        limitLabel: '5.0m Min Safe Clearance',
        v1CurrentVal: `${(bSnap?.ground_truth_target?.gap_m ?? 40).toFixed(2)} m`,
        v2CurrentVal: `${(cSnap?.ground_truth_target?.gap_m ?? 40).toFixed(2)} m`,
        v1Points: bTrace.map((pt) => ({
          t: pt.t_s,
          y: Math.min(45, pt.ground_truth_target?.gap_m ?? 45),
        })),
        v2Points: cTrace.map((pt) => ({
          t: pt.t_s,
          y: Math.min(45, pt.ground_truth_target?.gap_m ?? 45),
        })),
      },
      {
        id: 'ch3_decel',
        title: 'CH3: AEB DECELERATION (M/S²)',
        unit: 'm/s²',
        minY: -10,
        maxY: 3,
        limitValue: -8.5,
        limitLabel: '-8.5 m/s² Full AEB',
        v1CurrentVal: `${(bSnap?.ego.acceleration_mps2 ?? 0).toFixed(2)} m/s²`,
        v2CurrentVal: `${(cSnap?.ego.acceleration_mps2 ?? 0).toFixed(2)} m/s²`,
        v1Points: bTrace.map((pt) => ({ t: pt.t_s, y: pt.ego.acceleration_mps2 })),
        v2Points: cTrace.map((pt) => ({ t: pt.t_s, y: pt.ego.acceleration_mps2 })),
      },
    ];
  } else {
    const v1Tel = bmsScenarioEntry.v1_baseline.telemetry;
    const v2Tel = bmsScenarioEntry.v2_candidate.telemetry;

    const s1 = sampleBmsArraysAt(v1Tel, clampedTimeS);
    const s2 = sampleBmsArraysAt(v2Tel, clampedTimeS);

    channels = [
      {
        id: 'ch1_curr',
        title: 'CH1: CHARGE CURRENT (A)',
        unit: 'A',
        minY: 0,
        maxY: 2.0,
        limitValue: 0.8125,
        limitLabel: 'JEITA 0.8125A Cold Limit',
        v1CurrentVal: `${s1.current_a.toFixed(3)} A`,
        v2CurrentVal: `${s2.current_a.toFixed(3)} A`,
        v1Points: v1Tel.t.map((tVal, i) => ({
          t: tVal,
          y: v1Tel.current_a[i] ?? 0,
        })),
        v2Points: v2Tel.t.map((tVal, i) => ({
          t: tVal,
          y: v2Tel.current_a[i] ?? 0,
        })),
      },
      {
        id: 'ch2_temp',
        title: 'CH2: CELL TEMPERATURE (°C)',
        unit: '°C',
        minY: -6,
        maxY: 55,
        limitValue: 45.0,
        limitLabel: '45.0°C Max Thermal Limit',
        v1CurrentVal: `${s1.temp_c.toFixed(1)} °C`,
        v2CurrentVal: `${s2.temp_c.toFixed(1)} °C`,
        v1Points: v1Tel.t.map((tVal, i) => ({
          t: tVal,
          y: v1Tel.temp_c[i] ?? 25,
        })),
        v2Points: v2Tel.t.map((tVal, i) => ({
          t: tVal,
          y: v2Tel.temp_c[i] ?? 25,
        })),
      },
      {
        id: 'ch3_fault',
        title: 'CH3: CONTACTOR / PLATING RISK (%)',
        unit: '%',
        minY: 0,
        maxY: 100,
        limitValue: 15.0,
        limitLabel: 'Anode Plating Threshold',
        v1CurrentVal: `${s1.plating_risk_pct.toFixed(1)}% (C:${s1.contactor_state})`,
        v2CurrentVal: `${s2.plating_risk_pct.toFixed(1)}% (C:${s2.contactor_state})`,
        v1Points: v1Tel.t.map((tVal, i) => ({
          t: tVal,
          y: Math.max(
            v1Tel.plating_risk_pct[i] ?? 0,
            (v1Tel.contactor_state[i] ?? 0) * 90
          ),
        })),
        v2Points: v2Tel.t.map((tVal, i) => ({
          t: tVal,
          y: Math.max(
            v2Tel.plating_risk_pct[i] ?? 0,
            (v2Tel.contactor_state[i] ?? 0) * 90
          ),
        })),
      },
    ];
  }

  return (
    <section
      className={`h-52 shrink-0 bg-white border-t flex flex-col select-none overflow-hidden transition-all duration-300 ${
        isHighlighted
          ? 'border-indigo-500 ring-2 ring-inset ring-indigo-500/80 shadow-[0_0_24px_rgba(99,102,241,0.35)]'
          : 'border-slate-300'
      }`}
    >
      {/* PANEL 3 HEADER */}
      <div
        data-demo-target="telemetry-scopes-tab"
        className={`h-7 border-b px-3 flex items-center justify-between shrink-0 transition-colors ${
          isHighlighted
            ? 'bg-indigo-50 border-indigo-200'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700">
            LIVE TELEMETRY SCOPES — v1.0 BASELINE (BLUE) vs v2.0 CANDIDATE (RED)
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
            <span className="w-2.5 h-0.5 bg-blue-600 inline-block" />
            v1.0 Baseline (Safe)
          </span>
          <span className="flex items-center gap-1.5 text-red-700 font-semibold">
            <span className="w-2.5 h-0.5 bg-red-600 inline-block" />
            v2.0 Candidate (OTA)
          </span>
          <span className="flex items-center gap-1.5 text-red-600/80">
            <span className="w-2.5 h-0 border-t border-dashed border-red-500 inline-block" />
            Safety Limit
          </span>
        </div>
      </div>

      {/* 3 Side-by-Side Live Oscilloscope Channels */}
      <div className="flex-1 grid grid-cols-3 divide-x divide-slate-200 min-h-0">
        {channels.map((ch) => {
          const W = 360;
          const H = 128;
          const padL = 32;
          const padR = 10;
          const padT = 10;
          const padB = 18;
          const plotW = W - padL - padR;
          const plotH = H - padT - padB;

          const toX = (t: number) =>
            padL + Math.min(1, Math.max(0, t / Math.max(durationS, 0.01))) * plotW;
          const toY = (val: number) => {
            const norm = (val - ch.minY) / Math.max(ch.maxY - ch.minY, 0.001);
            return padT + (1 - Math.min(1, Math.max(0, norm))) * plotH;
          };

          const buildPath = (pts: Array<{ t: number; y: number }>, maxT?: number) => {
            const filtered =
              maxT !== undefined ? pts.filter((p) => p.t <= maxT + 1e-4) : pts;
            if (filtered.length === 0) return '';
            const step = Math.max(1, Math.floor(filtered.length / 160));
            const sampled = filtered.filter(
              (_, idx) => idx % step === 0 || idx === filtered.length - 1
            );
            return sampled
              .map(
                (p, idx) =>
                  `${idx === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.y).toFixed(1)}`
              )
              .join(' ');
          };

          const v1FullPath = buildPath(ch.v1Points);
          const v2FullPath = buildPath(ch.v2Points);
          const v1LivePath = buildPath(ch.v1Points, clampedTimeS);
          const v2LivePath = buildPath(ch.v2Points, clampedTimeS);
          const cursorX = toX(clampedTimeS);
          const limitY =
            ch.limitValue !== undefined ? toY(ch.limitValue) : undefined;

          return (
            <div
              key={ch.id}
              className="flex flex-col justify-between p-2 bg-white hover:bg-slate-50/40 transition-colors min-w-0"
            >
              {/* Channel Title + Instantaneous Readout */}
              <div className="flex items-center justify-between gap-1 px-1">
                <span className="font-mono text-[10px] font-bold text-slate-700 truncate">
                  {ch.title}
                </span>
                <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums shrink-0">
                  <span className="text-blue-700 font-bold">{ch.v1CurrentVal}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-red-600 font-bold">{ch.v2CurrentVal}</span>
                </div>
              </div>

              {/* SVG Waveform Canvas */}
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full flex-1 min-h-0 cursor-crosshair select-none"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX =
                    ((e.clientX - rect.left) / rect.width) * W - padL;
                  const ratio = Math.min(1, Math.max(0, relX / plotW));
                  onChangePlaybackTimeS(ratio * durationS);
                }}
              >
                {/* Engineering Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((g) => {
                  const gy = padT + g * plotH;
                  const val = ch.maxY - g * (ch.maxY - ch.minY);
                  return (
                    <g key={g}>
                      <line
                        x1={padL}
                        y1={gy}
                        x2={W - padR}
                        y2={gy}
                        stroke="#E2E8F0"
                        strokeWidth="0.75"
                      />
                      {(g === 0 || g === 0.5 || g === 1) && (
                        <text
                          x={padL - 4}
                          y={gy + 3}
                          textAnchor="end"
                          className="fill-slate-400 font-mono text-[8px]"
                        >
                          {val.toFixed(Math.abs(ch.maxY - ch.minY) <= 5 ? 1 : 0)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {[0, 0.25, 0.5, 0.75, 1].map((gx) => {
                  const x = padL + gx * plotW;
                  return (
                    <line
                      key={gx}
                      x1={x}
                      y1={padT}
                      x2={x}
                      y2={H - padB}
                      stroke="#F1F5F9"
                      strokeWidth="0.75"
                    />
                  );
                })}

                {/* Red Horizontal Dashed Safety Limit Line */}
                {limitY !== undefined && (
                  <g>
                    <line
                      x1={padL}
                      y1={limitY}
                      x2={W - padR}
                      y2={limitY}
                      stroke="#DC2626"
                      strokeWidth="1.1"
                      strokeDasharray="4 3"
                    />
                    {ch.limitLabel && (
                      <text
                        x={W - padR - 3}
                        y={Math.max(padT + 8, limitY - 3)}
                        textAnchor="end"
                        className="fill-red-600 font-mono text-[8px] font-bold"
                      >
                        {ch.limitLabel}
                      </text>
                    )}
                  </g>
                )}

                {/* Faint Full-Scenario Reference Envelopes */}
                <path
                  d={v1FullPath}
                  fill="none"
                  stroke="#93C5FD"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.55"
                />
                <path
                  d={v2FullPath}
                  fill="none"
                  stroke="#FCA5A5"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.55"
                />

                {/* Bold Real-Time Drawn Waveforms up to playbackTimeS */}
                <path
                  d={v1LivePath}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={v2LivePath}
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Synchronized Playhead Cursor */}
                <line
                  x1={cursorX}
                  y1={padT}
                  x2={cursorX}
                  y2={H - padB}
                  stroke="#0F172A"
                  strokeWidth="1.2"
                />
                <circle cx={cursorX} cy={padT + 2} r="2.5" fill="#0F172A" />

                {/* Time Axis Labels */}
                <text
                  x={padL}
                  y={H - 4}
                  className="fill-slate-400 font-mono text-[8px]"
                >
                  0.0s
                </text>
                <text
                  x={padL + plotW / 2}
                  y={H - 4}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[8px]"
                >
                  T = {clampedTimeS.toFixed(2)}s
                </text>
                <text
                  x={W - padR}
                  y={H - 4}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[8px]"
                >
                  {durationS.toFixed(0)}s
                </text>
              </svg>
            </div>
          );
        })}
      </div>
    </section>
  );
};
