import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Cpu,
  Volume2,
  X,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export interface VirtualCursorState {
  x: number;
  y: number;
  clicking: boolean;
  label?: string;
  visible: boolean;
}

export interface LaunchVideoOverlayProps {
  isActive: boolean;
  elapsedS: number;
  durationS: number;
  cursor: VirtualCursorState;
  hasCustomMp3: boolean;
  mp3FileName?: string | null;
  onStopDemo: () => void;
}

export const LaunchVideoOverlay: React.FC<LaunchVideoOverlayProps> = ({
  isActive,
  elapsedS,
  durationS,
  cursor,
  hasCustomMp3,
  mp3FileName,
  onStopDemo,
}) => {
  if (!isActive) return null;

  // Determine active step (1..4) based on 45-second timeline
  const currentStep =
    elapsedS < 9 ? 1 : elapsedS < 20 ? 2 : elapsedS < 32 ? 3 : 4;

  // Step 1 toast notification (2.5s - 8.8s)
  const showStep1IndexingToast = elapsedS >= 2.5 && elapsedS < 9.0;

  // Step 2 hazard toast notification (11.2s - 19.8s)
  const showStep2HazardToast = elapsedS >= 11.2 && elapsedS < 20.0;

  // Step 4 slamming homologation stamp (35.5s - 45.0s)
  const showStep4BlockedStamp = elapsedS >= 35.5;

  const progressPct = Math.min(100, Math.max(0, (elapsedS / durationS) * 100));

  const stepMeta = {
    1: {
      badge: 'STEP 1 OF 4 · 0s–9s',
      title: '📦 Candidate OTA v2.0: Unit Tests 17/17 Passed — Winter Charge -44% Faster',
      subtitle:
        'Staging Supplier OTA package and indexing ELF64 binary symbols vs Baseline v1.0.0...',
    },
    2: {
      badge: 'STEP 2 OF 4 · 9s–20s',
      title: '⚡ BMS 5°C Cold Charge (1.625A Spike) & ADAS Braking (-3.88m Loss)',
      subtitle:
        'Evaluating 10 BMS thermal cell scenarios and 7 ADAS highway braking kinematics cases...',
    },
    3: {
      badge: 'STEP 3 OF 4 · 20s–32s',
      title: '🚗 3D Digital Twin Shadow Simulation & Multi-Channel Telemetry Scopes',
      subtitle:
        'Comparing Blue Car (v1.0.0 Safe Baseline) vs Red Car (v2.0.0 Late AEB Trigger) at 60 FPS...',
    },
    4: {
      badge: 'STEP 4 OF 4 · 32s–45s',
      title: '🔍 REA Binary AST Diff Proof & ISO 26262 ASIL-D Homologation Gate',
      subtitle:
        'Pinpointing aeb_ttc_s (2.0s ➔ 1.8s) and MAX_TEMP_C (45°C ➔ 50°C) inside compiled binary...',
    },
  }[currentStep];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden select-none">
      {/* 1. TOP-CENTER SLEEK DARK INTRO & STEP CHOREOGRAPHY BANNER */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4 pointer-events-auto">
        <div className="bg-slate-950/95 backdrop-blur-md text-white border border-indigo-500/50 rounded-xl shadow-[0_16px_50px_rgba(15,23,42,0.55)] overflow-hidden">
          <div className="px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-[10px] font-bold tracking-wider uppercase shrink-0 flex items-center gap-1">
                <Volume2 className="w-3 h-3 animate-pulse" />
                {stepMeta.badge}
              </span>
              <span className="font-display font-bold text-xs md:text-sm text-white truncate">
                {stepMeta.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[11px] text-indigo-300">
                {elapsedS.toFixed(1)}s / {durationS.toFixed(0)}s
              </span>
              {hasCustomMp3 && (
                <span
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px]"
                  title={mp3FileName || 'Custom ElevenLabs MP3 Playing'}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  MP3 SYNCED
                </span>
              )}
              <button
                onClick={onStopDemo}
                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Stop Walkthrough"
              >
                <X className="w-3 h-3" />
                <span>Stop</span>
              </button>
            </div>
          </div>

          <div className="px-4 pb-2 text-[11px] font-mono text-slate-300 flex items-center justify-between">
            <span className="truncate">{stepMeta.subtitle}</span>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className={`w-5 h-1.5 rounded-full transition-colors ${
                    s === currentStep
                      ? 'bg-indigo-400'
                      : s < currentStep
                      ? 'bg-emerald-400'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1 w-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. STEP 1 TOAST: REA BINARY INDEXING COMPLETE */}
      {showStep1IndexingToast && (
        <div className="fixed top-32 right-6 z-50 max-w-md bg-slate-900/95 text-white border-2 border-emerald-500/80 rounded-xl px-4 py-3 shadow-2xl flex items-start gap-3 animate-bounce">
          <Cpu className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs font-mono">
            <div className="font-bold text-emerald-300">
              🔍 REA Binary Indexing Complete: update_v2.bin vs update_v1.bin
            </div>
            <div className="text-slate-300 text-[11px] mt-0.5">
              Decompiled 14 ELF64 symbols · 17 physical SIL test cases staged for execution.
            </div>
          </div>
        </div>
      )}

      {/* 3. STEP 2 TOAST: BMS LITHIUM PLATING & ADAS BRAKING HAZARD */}
      {showStep2HazardToast && (
        <div className="fixed top-32 left-6 z-50 max-w-md bg-rose-950/95 text-white border-2 border-rose-500 rounded-xl px-4 py-3 shadow-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs font-mono">
            <div className="font-bold text-rose-300">
              ⚠️ Physical Regressions Caught in Closed-Loop SIL!
            </div>
            <div className="text-rose-100 text-[11px] mt-0.5">
              • BMS-02 (5°C Cold): 1.625A spike violates 0.65A JEITA lithium plating limit
              <br />• ADAS Braking: 1.8s TTC loses -3.88m of stopping clearance
            </div>
          </div>
        </div>
      )}

      {/* 4. STEP 4 SLAMMING HOMOLOGATION GATE BLOCKED BANNER */}
      {showStep4BlockedStamp && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="px-6 py-3.5 rounded-2xl bg-slate-950/95 border-2 border-rose-500 shadow-[0_0_60px_rgba(225,29,72,0.65)] flex items-center gap-3.5">
            <ShieldAlert className="w-7 h-7 text-rose-500 shrink-0 animate-bounce" />
            <div>
              <div className="font-mono text-xs md:text-sm font-black tracking-wider text-rose-400 uppercase">
                🛑 OTA v2.0.0 BLOCKED BY DELTAGUARD — ISO 26262 ASIL-D &amp; JEITA
              </div>
              <div className="font-mono text-[11px] text-slate-300">
                2 Critical Binary Regressions Verified: aeb_ttc_s (2.0s ➔ 1.8s) &amp; max_charge_temp (45°C ➔ 50°C)
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>
        </div>
      )}

      {/* 5. SLEEK ANIMATED VIRTUAL MOUSE CURSOR WITH GLOWING CLICK RIPPLE RING */}
      {cursor.visible && (
        <div
          className="fixed z-50 pointer-events-none transition-all duration-700 ease-in-out"
          style={{
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            transform: 'translate(-4px, -4px)',
          }}
        >
          {/* Glowing Blue Click-Ripple Ring */}
          <div
            className={`absolute -left-5 -top-5 w-12 h-12 rounded-full border-2 transition-all duration-300 ${
              cursor.clicking
                ? 'scale-150 border-sky-400 bg-sky-400/35 opacity-100 shadow-[0_0_25px_rgba(56,189,248,0.9)]'
                : 'scale-75 border-indigo-400/70 bg-indigo-500/15 opacity-80 animate-ping'
            }`}
          />

          {/* High-Contrast Precision Pointer Arrow SVG */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className={`relative z-10 drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)] transition-transform duration-150 ${
              cursor.clicking ? 'scale-90' : 'scale-100'
            }`}
          >
            <path
              d="M4 3L11.5 20L14.2 13.8L20.5 11.2L4 3Z"
              fill="#4F46E5"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>

          {/* Floating Action Callout Pill Next to Cursor */}
          {cursor.label && (
            <div className="ml-6 -mt-2 px-3 py-1 rounded-full bg-slate-950/95 text-white border border-sky-400/60 shadow-xl font-mono text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  cursor.clicking ? 'bg-sky-400 animate-ping' : 'bg-indigo-400'
                }`}
              />
              <span>{cursor.label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
