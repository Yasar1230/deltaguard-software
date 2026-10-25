import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  DeltaGuardStatePayload,
  Agent37SandboxReceipt,
} from './types/deltaguard';
import {
  ADAS_SCENARIOS,
  DEFAULT_BASELINE_PACKAGE,
  DEFAULT_CANDIDATE_PACKAGE,
  AdasUpdatePackage,
  executeComparisonScenario,
  buildExportArtifacts,
  downloadJsonFile,
} from './engine/adasSimEngine';
import {
  DeltaGuardTopBar,
  WorkbenchLayoutPreset,
} from './components/DeltaGuardTopBar';
import { DeltaGuardSidebar } from './components/DeltaGuardSidebar';
import {
  SimulinkWorld3DView,
  CameraPreset,
  WorldMode3D,
} from './components/SimulinkWorld3DView';
import { LiveOscilloscopeDock } from './components/LiveOscilloscopeDock';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import { DockedTimelineBar } from './components/DockedTimelineBar';
import { QuickStageOtaDrawer } from './components/QuickStageOtaDrawer';
import { PatchPreviewModal } from './components/PatchPreviewModal';
import { ReaBinaryDiffView } from './components/ReaBinaryDiffView';
import { ScenarioMatrixView } from './components/ScenarioMatrixView';
import {
  FoxgloveLandingPage,
  CarouselSlideTarget,
} from './components/FoxgloveLandingPage';
import {
  LaunchVideoOverlay,
  VirtualCursorState,
} from './components/LaunchVideoOverlay';
import {
  playClickSound,
  playAlertBeep,
  loadVoiceoverFile,
  playVoiceoverTrack,
  stopVoiceoverTrack,
  getVoiceoverElapsedS,
} from './utils/soundEffects';
import { RefreshCw, AlertCircle, Cpu, Layers, X } from 'lucide-react';

const LAUNCH_VIDEO_DURATION_S = 45.0;

const FALLBACK_LAUNCH_NARRATION =
  'Candidate OTA version 2.0 passed all 17 standard unit tests and promises 44 percent faster winter charging. ' +
  'DeltaGuard indexes the stripped binary and runs 17 closed-loop physical simulations. ' +
  'In BMS 5-degree cold charging, DeltaGuard catches a 1.625 amp current spike that violates JEITA lithium plating limits. ' +
  'In ADAS highway braking, our 3D Digital Twin and live telemetry scopes expose a 3.88 meter stopping gap loss. ' +
  'Reverse engineering proves the supplier delayed AEB time-to-collision and raised thermal cutoff to 50 degrees Celsius. ' +
  'OTA version 2.0 is automatically blocked by DeltaGuard under ISO 26262 ASIL-D and JEITA.';

function getDemoTargetCenter(
  targetId: string,
  fallbackX: number,
  fallbackY: number
): { x: number; y: number } {
  if (typeof document === 'undefined') {
    return { x: fallbackX, y: fallbackY };
  }
  const el = document.querySelector(
    `[data-demo-target="${targetId}"]`
  ) as HTMLElement | null;
  if (!el) {
    return { x: fallbackX, y: fallbackY };
  }
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return { x: fallbackX, y: fallbackY };
  }
  return {
    x: Math.round(rect.left + rect.width * 0.5),
    y: Math.round(rect.top + rect.height * 0.5),
  };
}

async function safeParseJson(resp: Response): Promise<any | null> {
  try {
    const text = await resp.text();
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith('<')) {
      return null;
    }
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export default function App() {
  const [statePayload, setStatePayload] = useState<DeltaGuardStatePayload | null>(
    null
  );
  const initialBrokenStateRef = useRef<DeltaGuardStatePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 2-View SaaS Product State: View 1 ('landing') vs View 2 ('workbench')
  const [activeAppView, setActiveAppView] = useState<'landing' | 'workbench'>(
    'landing'
  );

  // Workbench Layout & Domain State
  const [layoutPreset, setLayoutPreset] =
    useState<WorkbenchLayoutPreset>('foxglove_default');
  const [activeModelDomain, setActiveModelDomain] = useState<'adas' | 'bms'>(
    'adas'
  );
  const [worldMode, setWorldMode] = useState<WorldMode3D>('adas_track');

  // Staged Playback State (Starts paused at T = 0.00s until user clicks Run or Launch Video)
  const [playbackTimeS, setPlaybackTimeS] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('chase');

  // ADAS & BMS Scenario Selection
  const [selectedAdasScenarioId, setSelectedAdasScenarioId] =
    useState<string>('lead_brake');
  const [selectedBmsScenarioId, setSelectedBmsScenarioId] =
    useState<string>('SCEN-02');
  const [baselinePkg] = useState<AdasUpdatePackage>(DEFAULT_BASELINE_PACKAGE);
  const [candidatePkg, setCandidatePkg] = useState<AdasUpdatePackage>(
    DEFAULT_CANDIDATE_PACKAGE
  );
  const [stagedPackageLabel, setStagedPackageLabel] = useState<string>(
    'Supplier OTA v2.0.0-rc3 (bms_v2.so + update_v2.json)'
  );

  // Modals, Drawers & Execution Flags
  const [isStageDrawerOpen, setIsStageDrawerOpen] = useState<boolean>(false);
  const [isPatchModalOpen, setIsPatchModalOpen] = useState<boolean>(false);
  const [isFullInspectorOpen, setIsFullInspectorOpen] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<'rea_diff' | 'bms_matrix'>(
    'rea_diff'
  );
  const [isRunningSuite, setIsRunningSuite] = useState<boolean>(false);
  const [isPatching, setIsPatching] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [, setLastSandboxReceipt] = useState<Agent37SandboxReceipt | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // =========================================================================
  // LAUNCH TRAILER ENGINE STATE (ElevenLabs MP3 + 4-Step Virtual Cursor Demo)
  // =========================================================================
  const [voiceoverAudioUrl, setVoiceoverAudioUrl] = useState<string | null>(null);
  const [voiceoverFileName, setVoiceoverFileName] = useState<string | null>(null);

  const [isLaunchVideoPlaying, setIsLaunchVideoPlaying] = useState<boolean>(false);
  const [launchVideoElapsedS, setLaunchVideoElapsedS] = useState<number>(0);
  const [virtualCursor, setVirtualCursor] = useState<VirtualCursorState>({
    x: 520,
    y: 28,
    clicking: false,
    label: '',
    visible: false,
  });
  const [isScopesHighlighted, setIsScopesHighlighted] = useState<boolean>(false);
  const [isCrimsonDiffHighlighted, setIsCrimsonDiffHighlighted] =
    useState<boolean>(false);
  const firedCueSetRef = useRef<Set<string>>(new Set());

  // Global Web Audio API mechanical click sound on every real button click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest('button, [role="button"], select');
      if (btn) {
        playClickSound();
      }
    };
    document.addEventListener('click', handleGlobalClick, true);
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  const handleAttachVoiceoverMp3 = useCallback(async (file: File) => {
    setVoiceoverFileName(file.name);
    const { url } = await loadVoiceoverFile(file);
    setVoiceoverAudioUrl(url);
    // Play immediate confirmation so user hears their MP3 is decoded & ready
    await playVoiceoverTrack(0);
  }, []);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/deltaguard/state');
      const data = await safeParseJson(resp);
      if (data && data.diffOutput) {
        setStatePayload(data);
        if (
          !initialBrokenStateRef.current &&
          data.diffOutput.failed_scenarios_count > 0
        ) {
          initialBrokenStateRef.current = data;
        }
        return;
      }

      // Fallback to static bundle snapshots if backend is still booting
      const [diffResp, reaResp, ruleResp, auditResp] = await Promise.all([
        fetch('/data/diff_output.json'),
        fetch('/data/rea_binary_analysis.json'),
        fetch('/data/homologation_rulebook.json'),
        fetch('/data/homologation_audit_report.json'),
      ]);
      const [diffOutput, reaAnalysis, rulebook, auditReport] = await Promise.all([
        safeParseJson(diffResp),
        safeParseJson(reaResp),
        safeParseJson(ruleResp),
        safeParseJson(auditResp),
      ]);
      if (diffOutput && reaAnalysis && rulebook && auditReport) {
        const fallbackPayload: DeltaGuardStatePayload = {
          diffOutput,
          reaAnalysis,
          rulebook,
          auditReport,
          v1SourceC: '/* Panasonic NCR18650B Baseline v1.0.0 */',
          v2SourceC: '/* Candidate OTA v2.4.1-rc3 */',
        };
        setStatePayload(fallbackPayload);
        if (!initialBrokenStateRef.current) {
          initialBrokenStateRef.current = fallbackPayload;
        }
        return;
      }

      throw new Error(`HTTP ${resp.status}: Failed to load DeltaGuard state`);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch DeltaGuard state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const activeAdasScenario = useMemo(
    () =>
      ADAS_SCENARIOS.find((s) => s.id === selectedAdasScenarioId) ||
      ADAS_SCENARIOS[0],
    [selectedAdasScenarioId]
  );

  const adasComparisonRun = useMemo(
    () =>
      executeComparisonScenario(activeAdasScenario, baselinePkg, candidatePkg),
    [activeAdasScenario, baselinePkg, candidatePkg]
  );

  const applyClientSidePatchFallback = useCallback(
    (mode: 'apply_fix' | 'restore_regressions') => {
      if (mode === 'restore_regressions' && initialBrokenStateRef.current) {
        setStatePayload(initialBrokenStateRef.current);
        return;
      }
      setStatePayload((prev) => {
        if (!prev) return null;
        if (mode === 'apply_fix') {
          const patchedScenarios = prev.diffOutput.scenarios.map((entry) => ({
            ...entry,
            v2_candidate: {
              ...entry.v1_baseline,
            },
            homologation_gate: {
              ...entry.homologation_gate,
              naive_test_verdict: 'PASS',
              deltaguard_verdict: 'APPROVED — ASIL-D & JEITA COMPLIANT',
              is_deceptive_regression: false,
              charge_time_delta_pct: 0,
              violations: [],
            },
          }));
          return {
            ...prev,
            diffOutput: {
              ...prev.diffOutput,
              overall_release_verdict: 'APPROVED FOR PRODUCTION OTA ROLLOUT',
              failed_scenarios_count: 0,
              deceptive_scenarios_count: 0,
              total_violations_count: 0,
              scenarios: patchedScenarios,
            },
            v2SourceC:
              `/* DeltaGuard Auto-Remediated Candidate Firmware (v2.0.1-ASIL-D-VERIFIED) */\n` +
              prev.v1SourceC,
          };
        }
        return initialBrokenStateRef.current || prev;
      });
    },
    []
  );

  // =========================================================================
  // STOP / START 4-STEP LAUNCH VIDEO WALKTHROUGH (VIRTUAL MOUSE CURSOR)
  // =========================================================================
  const handleStopLaunchVideo = useCallback(() => {
    setIsLaunchVideoPlaying(false);
    setVirtualCursor((prev) => ({ ...prev, visible: false, clicking: false }));
    setIsScopesHighlighted(false);
    setIsCrimsonDiffHighlighted(false);

    stopVoiceoverTrack();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const handlePlayLaunchVideo = useCallback(() => {
    // Switch to the live Workbench view and stage the broken v2.0.0 candidate
    setActiveAppView('workbench');
    setIsStageDrawerOpen(false);
    setIsPatchModalOpen(false);
    setIsFullInspectorOpen(false);

    applyClientSidePatchFallback('restore_regressions');
    setCandidatePkg(DEFAULT_CANDIDATE_PACKAGE);
    setStagedPackageLabel(
      'Supplier OTA v2.0.0-rc3 (bms_v2.so + update_v2.json)'
    );

    setActiveModelDomain('adas');
    setWorldMode('adas_track');
    setSelectedAdasScenarioId('lead_brake');
    setIsPlaying(false);
    setPlaybackTimeS(0);
    setIsScopesHighlighted(false);
    setIsCrimsonDiffHighlighted(false);

    firedCueSetRef.current.clear();
    setLaunchVideoElapsedS(0);
    setVirtualCursor({
      x: Math.round(window.innerWidth * 0.45),
      y: Math.round(window.innerHeight * 0.25),
      clicking: false,
      label: 'Initializing DeltaGuard SIL Walkthrough...',
      visible: true,
    });
    setIsLaunchVideoPlaying(true);

    // Play attached ElevenLabs MP3 from 0.0s via persistent Web Audio API + HTMLAudio engine
    if (voiceoverAudioUrl) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      playVoiceoverTrack(0);
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(FALLBACK_LAUNCH_NARRATION);
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    }
  }, [applyClientSidePatchFallback, voiceoverAudioUrl]);

  // 45-Second Choreographed Virtual Mouse Cursor & UI Automation Engine
  useEffect(() => {
    if (!isLaunchVideoPlaying) return;

    const startTimeMs = performance.now();

    const triggerClickPulse = (label?: string) => {
      playClickSound();
      setVirtualCursor((prev) => ({
        ...prev,
        clicking: true,
        label: label ?? prev.label,
      }));
      window.setTimeout(() => {
        setVirtualCursor((prev) => ({ ...prev, clicking: false }));
      }, 280);
    };

    const intervalId = window.setInterval(() => {
      const wallElapsedS = (performance.now() - startTimeMs) / 1000;
      const customElapsed = getVoiceoverElapsedS();
      const elapsedS =
        customElapsed !== null && customElapsed > 0.05
          ? Math.min(wallElapsedS, LAUNCH_VIDEO_DURATION_S + 0.5)
          : wallElapsedS;

      setLaunchVideoElapsedS(elapsedS);
      const cues = firedCueSetRef.current;

      // ---------------------------------------------------------------------
      // STEP 1 (0s – 9s): Uploading & Indexing the OTA Update
      // ---------------------------------------------------------------------
      if (elapsedS >= 0.4 && !cues.has('step1_move_load_ota')) {
        cues.add('step1_move_load_ota');
        const pos = getDemoTargetCenter('load-ota-btn', 480, 24);
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: '1. Staging Candidate OTA v2.0 Package',
          visible: true,
        });
      }

      if (elapsedS >= 2.5 && !cues.has('step1_click_load_ota')) {
        cues.add('step1_click_load_ota');
        const pos = getDemoTargetCenter('load-ota-btn', 480, 24);
        setVirtualCursor((prev) => ({
          ...prev,
          x: pos.x,
          y: pos.y,
          label: 'Indexing update_v2.bin vs update_v1.bin...',
        }));
        triggerClickPulse('Indexing update_v2.bin vs update_v1.bin...');
        setStagedPackageLabel(
          'Candidate OTA v2.0 (update_v2.bin vs update_v1.bin — Indexed)'
        );
      }

      // ---------------------------------------------------------------------
      // STEP 2 (9s – 20s): Testing BMS 5°C Cold Charge & ADAS Braking
      // ---------------------------------------------------------------------
      if (elapsedS >= 9.0 && !cues.has('step2_move_bms_tab')) {
        cues.add('step2_move_bms_tab');
        const pos = getDemoTargetCenter('tab-bms', 245, 64);
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: 'Switch to BMS Battery (10 Cases)',
          visible: true,
        });
      }

      if (elapsedS >= 9.8 && !cues.has('step2_click_bms_tab')) {
        cues.add('step2_click_bms_tab');
        const el = document.querySelector(
          '[data-demo-target="tab-bms"]'
        ) as HTMLElement | null;
        el?.click();
        setActiveModelDomain('bms');
        setWorldMode('bms_pack');
        triggerClickPulse('BMS Battery Suite Selected');
      }

      if (elapsedS >= 10.4 && !cues.has('step2_move_bms_02')) {
        cues.add('step2_move_bms_02');
        const pos = getDemoTargetCenter('scen-bms-SCEN-02', 140, 145);
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: 'Select BMS-02: 5°C Cold Charge',
          visible: true,
        });
      }

      if (elapsedS >= 11.2 && !cues.has('step2_click_bms_02')) {
        cues.add('step2_click_bms_02');
        setSelectedBmsScenarioId('SCEN-02');
        setActiveModelDomain('bms');
        setWorldMode('bms_pack');
        setPlaybackTimeS(1800);
        triggerClickPulse('⚡ 1.625A JEITA Lithium Plating Hazard!');
        playAlertBeep();
      }

      if (elapsedS >= 14.8 && !cues.has('step2_move_adas_tab')) {
        cues.add('step2_move_adas_tab');
        const pos = getDemoTargetCenter('tab-adas', 200, 64);
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: 'Switch to ADAS Driving (7 Cases)',
          visible: true,
        });
      }

      if (elapsedS >= 15.4 && !cues.has('step2_click_adas_tab')) {
        cues.add('step2_click_adas_tab');
        const el = document.querySelector(
          '[data-demo-target="tab-adas"]'
        ) as HTMLElement | null;
        el?.click();
        setActiveModelDomain('adas');
        setWorldMode('adas_track');
        triggerClickPulse('ADAS Driving Suite Selected');
      }

      if (elapsedS >= 16.0 && !cues.has('step2_move_adas_brake')) {
        cues.add('step2_move_adas_brake');
        const pos = getDemoTargetCenter('scen-adas-lead_brake', 140, 115);
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: 'Select Lead Vehicle Hard Braking',
          visible: true,
        });
      }

      if (elapsedS >= 16.6 && !cues.has('step2_click_adas_brake')) {
        cues.add('step2_click_adas_brake');
        setSelectedAdasScenarioId('lead_brake');
        setActiveModelDomain('adas');
        setWorldMode('adas_track');
        setPlaybackTimeS(0);
        setIsPlaying(false);
        triggerClickPulse('🚗 -3.88m Stopping Gap Regression');
      }

      if (elapsedS >= 18.0 && !cues.has('step2_move_wet_brake')) {
        cues.add('step2_move_wet_brake');
        const pos = getDemoTargetCenter('scen-adas-wet_lead_brake', 140, 148);
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: 'Inspect Wet Road Lead Braking (μ=0.4)',
          visible: true,
        });
      }

      if (elapsedS >= 18.6 && !cues.has('step2_click_wet_brake')) {
        cues.add('step2_click_wet_brake');
        setSelectedAdasScenarioId('lead_brake');
        triggerClickPulse('Staging 3D Highway Comparison');
      }

      // ---------------------------------------------------------------------
      // STEP 3 (20s – 32s): Running the 3D Digital Twin & Live Telemetry Scopes
      // ---------------------------------------------------------------------
      if (elapsedS >= 20.0 && !cues.has('step3_move_play')) {
        cues.add('step3_move_play');
        const pos = getDemoTargetCenter(
          'timeline-play-btn',
          48,
          window.innerHeight - 20
        );
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: '▶ Start 3D Digital Twin Shadow Simulation',
          visible: true,
        });
      }

      if (elapsedS >= 20.8 && !cues.has('step3_click_play')) {
        cues.add('step3_click_play');
        setActiveModelDomain('adas');
        setWorldMode('adas_track');
        setSelectedAdasScenarioId('lead_brake');
        setPlaybackTimeS(0);
        setIsPlaying(true);
        triggerClickPulse('Running 3D Digital Twin: Blue v1.0 vs Red v2.0');
      }

      if (elapsedS >= 26.2 && !cues.has('step3_move_scopes')) {
        cues.add('step3_move_scopes');
        const pos = getDemoTargetCenter(
          'telemetry-scopes-tab',
          Math.round(window.innerWidth * 0.5),
          Math.round(window.innerHeight - 235)
        );
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: 'Inspect Live Telemetry Scopes',
          visible: true,
        });
      }

      if (elapsedS >= 27.0 && !cues.has('step3_click_scopes')) {
        cues.add('step3_click_scopes');
        setIsScopesHighlighted(true);
        setPlaybackTimeS(1.2);
        setIsPlaying(true);
        triggerClickPulse('Live Multi-Channel Waveforms Synchronized');
      }

      if (elapsedS >= 29.5 && !cues.has('step3_move_twin')) {
        cues.add('step3_move_twin');
        const pos = getDemoTargetCenter(
          'digital-twin-tab',
          Math.round(window.innerWidth * 0.45),
          64
        );
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: 'Return to 3D Digital Twin Viewport',
          visible: true,
        });
      }

      if (elapsedS >= 30.2 && !cues.has('step3_click_twin')) {
        cues.add('step3_click_twin');
        setIsScopesHighlighted(false);
        triggerClickPulse('3D Digital Twin Active');
      }

      // ---------------------------------------------------------------------
      // STEP 4 (32s – 45s): REA Binary Diff Proof & AI Safety Gate Block
      // ---------------------------------------------------------------------
      if (elapsedS >= 32.0 && !cues.has('step4_move_rea')) {
        cues.add('step4_move_rea');
        const pos = getDemoTargetCenter(
          'rea-diff-crimson-box',
          window.innerWidth - 190,
          190
        );
        setVirtualCursor({
          x: pos.x,
          y: pos.y,
          clicking: false,
          label: 'Inspect REA Binary & AST Diff Proof',
          visible: true,
        });
      }

      if (elapsedS >= 33.0 && !cues.has('step4_click_rea')) {
        cues.add('step4_click_rea');
        setIsCrimsonDiffHighlighted(true);
        triggerClickPulse('Crimson Diff: aeb_ttc_s 2.0➔1.8 & MAX_TEMP 45°C➔50°C');
        playAlertBeep();
      }

      if (elapsedS >= 35.5 && !cues.has('step4_slam_stamp')) {
        cues.add('step4_slam_stamp');
        playAlertBeep();
        setVirtualCursor((prev) => ({
          ...prev,
          x: Math.round(window.innerWidth - 190),
          y: Math.round(window.innerHeight * 0.62),
          label: '🛑 OTA v2.0.0 BLOCKED — ISO 26262 ASIL-D & JEITA',
        }));
      }

      // Finish at 45s: fade out cursor and leave workbench ready for live Q&A
      if (elapsedS >= LAUNCH_VIDEO_DURATION_S) {
        window.clearInterval(intervalId);
        setIsLaunchVideoPlaying(false);
        setVirtualCursor((prev) => ({ ...prev, visible: false, clicking: false }));
        setIsScopesHighlighted(false);
      }
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLaunchVideoPlaying, voiceoverAudioUrl]);

  const handleChangeLayoutPreset = (preset: WorkbenchLayoutPreset) => {
    setLayoutPreset(preset);
    if (preset === 'adas_vector_focus') {
      setActiveModelDomain('adas');
      setWorldMode('adas_track');
    } else if (preset === 'bms_binary_focus') {
      setActiveModelDomain('bms');
      setWorldMode('bms_pack');
    }
  };

  const handleLaunchWorkbenchFromLanding = (target?: CarouselSlideTarget) => {
    setIsPlaying(false);
    setPlaybackTimeS(0);

    if (target === 'adas_twin') {
      setActiveModelDomain('adas');
      setWorldMode('adas_track');
      setSelectedAdasScenarioId('lead_brake');
      setLayoutPreset('adas_vector_focus');
      setIsFullInspectorOpen(false);
    } else if (target === 'bms_thermal') {
      setActiveModelDomain('bms');
      setWorldMode('bms_pack');
      setSelectedBmsScenarioId('SCEN-02');
      setLayoutPreset('bms_binary_focus');
      setIsFullInspectorOpen(false);
    } else if (target === 'rea_binary') {
      setActiveModelDomain('bms');
      setWorldMode('bms_pack');
      setSelectedBmsScenarioId('SCEN-02');
      setLayoutPreset('bms_binary_focus');
      setInspectorTab('rea_diff');
      setIsFullInspectorOpen(true);
    } else if (target === 'telemetry_scopes') {
      setActiveModelDomain('bms');
      setWorldMode('bms_pack');
      setSelectedBmsScenarioId('SCEN-02');
      setLayoutPreset('foxglove_default');
      setIsFullInspectorOpen(false);
    }

    setActiveAppView('workbench');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenUploadModalFromLanding = () => {
    setIsPlaying(false);
    setPlaybackTimeS(0);
    setActiveAppView('workbench');
    setIsStageDrawerOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // [▶ 2. RUN SIL TEST SUITE]: Plays selected case live and updates the 17-case matrix
  const handleRunSilTestSuite = async () => {
    setPlaybackTimeS(0);
    setIsPlaying(true);

    setIsRunningSuite(true);
    try {
      const resp = await fetch('/api/deltaguard/run-sil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceUrl: 'https://www.agent37.com/dashboard/cloud',
        }),
      });
      const data = await safeParseJson(resp);
      const nextState = data?.state || data;
      if (nextState?.diffOutput) {
        setStatePayload((prev) =>
          prev
            ? {
                ...prev,
                diffOutput: nextState.diffOutput,
                reaAnalysis: nextState.reaAnalysis ?? prev.reaAnalysis,
                auditReport: nextState.auditReport ?? prev.auditReport,
              }
            : null
        );
      }
      if (data?.sandboxReceipt) {
        setLastSandboxReceipt(data.sandboxReceipt);
      }
    } catch {
      // Continue live client playback smoothly if offline
    } finally {
      setIsRunningSuite(false);
    }
  };

  // [✨ 3. Auto-Patch Binary & Re-Verify]
  const handleApplyPatchMode = async (
    mode: 'apply_fix' | 'restore_regressions',
    autoPlayAfter = true
  ) => {
    setIsPatching(true);
    setIsCrimsonDiffHighlighted(false);
    try {
      let appliedFromBackend = false;
      try {
        const resp = await fetch('/api/deltaguard/apply-patch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
        const data = await safeParseJson(resp);
        const nextState = data?.state || data;
        if (nextState?.diffOutput) {
          appliedFromBackend = true;
          setStatePayload((prev) =>
            prev
              ? {
                  ...prev,
                  diffOutput: nextState.diffOutput,
                  reaAnalysis: nextState.reaAnalysis ?? prev.reaAnalysis,
                  auditReport: nextState.auditReport ?? prev.auditReport,
                  v2SourceC: nextState.v2SourceC ?? prev.v2SourceC,
                }
              : null
          );
        }
      } catch {
        appliedFromBackend = false;
      }

      if (!appliedFromBackend) {
        applyClientSidePatchFallback(mode);
      }

      if (mode === 'apply_fix') {
        setCandidatePkg({
          ...DEFAULT_CANDIDATE_PACKAGE,
          package_id: 'update_v2_patched',
          version: '2.0.1-patched',
          params: {
            ...DEFAULT_CANDIDATE_PACKAGE.params,
            aeb_ttc_s: 2.0,
            aeb_decel_mps2: 8.5,
          },
        });
        setStagedPackageLabel(
          'DeltaGuard Patched OTA v2.0.1 (ASIL-D & JEITA Verified)'
        );
      } else {
        setCandidatePkg(DEFAULT_CANDIDATE_PACKAGE);
        setStagedPackageLabel(
          'Supplier OTA v2.0.0-rc3 (bms_v2.so + update_v2.json)'
        );
      }

      setPlaybackTimeS(0);
      setIsPlaying(autoPlayAfter);
    } finally {
      setIsPatching(false);
      setIsPatchModalOpen(false);
    }
  };

  const handleStageCustomCSource = async (sourceC: string, label: string) => {
    setIsRunningSuite(true);
    try {
      const resp = await fetch('/api/deltaguard/upload-ota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSourceC: sourceC,
          sourceCodeC: sourceC,
          workspaceUrl: 'https://www.agent37.com/dashboard/cloud',
        }),
      });
      const data = await safeParseJson(resp);
      const nextState = data?.state || data;
      if (nextState?.diffOutput) {
        setStatePayload((prev) =>
          prev
            ? {
                ...prev,
                diffOutput: nextState.diffOutput,
                reaAnalysis: nextState.reaAnalysis ?? prev.reaAnalysis,
                auditReport: nextState.auditReport ?? prev.auditReport,
                v2SourceC: nextState.v2SourceC ?? sourceC,
              }
            : null
        );
      }
      setStagedPackageLabel(label);
      setPlaybackTimeS(0);
      setIsPlaying(false);
    } finally {
      setIsRunningSuite(false);
    }
  };

  const handlePlayAudioAlert = async () => {
    if (!statePayload) return;
    setIsGeneratingAudio(true);
    playAlertBeep();

    // If user uploaded a custom voiceover MP3, play it directly
    if (voiceoverAudioUrl) {
      const played = await playVoiceoverTrack();
      if (played) {
        setIsGeneratingAudio(false);
        return;
      }
    }

    const scriptText =
      statePayload.auditReport?.audio_briefing_script ||
      'DeltaGuard Safety Alert: Candidate OTA release v2.0.0 is blocked due to three critical violations: delayed emergency braking TTC threshold, deleted JEITA cold-weather lithium plating protection below 10 degrees Celsius, and raised thermal cutoff to 50 degrees Celsius.';

    try {
      const resp = await fetch('/api/deltaguard/tts-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptText, text: scriptText }),
      });
      const data = await safeParseJson(resp);
      if (data?.audioDataUrl && !data?.useBrowserSpeech && audioRef.current) {
        audioRef.current.src = data.audioDataUrl;
        await audioRef.current.play();
        setIsGeneratingAudio(false);
        return;
      }
    } catch {
      // Fallback to browser SpeechSynthesis
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(scriptText);
      utterance.rate = 1.02;
      utterance.onend = () => setIsGeneratingAudio(false);
      utterance.onerror = () => setIsGeneratingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsGeneratingAudio(false);
    }
  };

  const handleExportReport = () => {
    if (!statePayload) return;
    const { results, diff } = buildExportArtifacts(
      adasComparisonRun.baseline,
      adasComparisonRun.candidate
    );
    downloadJsonFile(
      'deltaguard_homologation_report.json',
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          staged_package: stagedPackageLabel,
          adas_results: results,
          adas_diff: diff,
          bms_sil_diff: statePayload.diffOutput,
          rea_binary_analysis: statePayload.reaAnalysis,
        },
        null,
        2
      )
    );
  };

  if (loading && !statePayload) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-300 rounded p-5 flex items-center gap-3 shadow-xs">
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
          <div className="flex flex-col">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
              Initializing DeltaGuard SIL — Foxglove &amp; Vector CANoe Workbench
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Loading 17-case SIL test matrix, 3D CAD vector engine &amp; ELF64 BMS binaries...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !statePayload) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6">
        <div className="bg-white border border-red-300 rounded p-5 max-w-md flex flex-col gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-red-700 font-display font-bold text-xs uppercase">
            <AlertCircle className="w-4 h-4" />
            <span>Workbench Telemetry Connection Error</span>
          </div>
          <p className="text-xs text-slate-600 font-mono">{error}</p>
          <button
            onClick={fetchState}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold self-start cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { diffOutput, reaAnalysis, rulebook, auditReport, v1SourceC, v2SourceC } =
    statePayload;

  const activeBmsScenarioEntry =
    diffOutput.scenarios.find((s) => s.scenario.id === selectedBmsScenarioId) ||
    diffOutput.scenarios[0];

  const isPatchedSafe =
    diffOutput.failed_scenarios_count === 0 &&
    candidatePkg.params.aeb_ttc_s >= baselinePkg.params.aeb_ttc_s;

  const durationS =
    activeModelDomain === 'adas'
      ? adasComparisonRun.scenario.duration_s
      : Math.max(
          activeBmsScenarioEntry.scenario.duration_s,
          activeBmsScenarioEntry.v1_baseline.summary.charge_time_s,
          activeBmsScenarioEntry.v2_candidate.summary.charge_time_s,
          60
        );

  const anomalyTimesS =
    activeModelDomain === 'adas'
      ? [
          adasComparisonRun.baseline.events.find((e) => e.type === 'aeb_engaged')
            ?.t_s ?? 2.1,
          adasComparisonRun.candidate.events.find((e) => e.type === 'aeb_engaged')
            ?.t_s ?? 3.1,
        ]
      : [durationS * 0.18, durationS * 0.42, durationS * 0.56];

  const adasFailOrWarnCount = ADAS_SCENARIOS.filter((s) => {
    const r = executeComparisonScenario(s, baselinePkg, candidatePkg);
    return r.candidate.metrics.collision || r.comparison.v2_worse_on_safety;
  }).length;

  const totalFailedOrWarnCount = isPatchedSafe
    ? 0
    : diffOutput.failed_scenarios_count + adasFailOrWarnCount;

  // VIEW 1: FOXGLOVE.DEV REPLICA FRONT PAGE FOR DELTAGUARD
  if (activeAppView === 'landing') {
    return (
      <FoxgloveLandingPage
        onLaunchWorkbench={handleLaunchWorkbenchFromLanding}
        onOpenUploadModalInWorkbench={handleOpenUploadModalFromLanding}
        isPatchedSafe={isPatchedSafe}
        hasVoiceoverMp3={Boolean(voiceoverAudioUrl)}
        voiceoverFileName={voiceoverFileName}
        onAttachVoiceoverMp3={handleAttachVoiceoverMp3}
        onPlayLaunchVideo={handlePlayLaunchVideo}
      />
    );
  }

  // VIEW 2: INTERACTIVE DELTAGUARD SIMULATION WORKBENCH
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-100 text-slate-900">
      <audio ref={audioRef} className="hidden" />

      {/* 4-Step Product Demo Walkthrough Overlay & Virtual Mouse Cursor */}
      <LaunchVideoOverlay
        isActive={isLaunchVideoPlaying}
        elapsedS={launchVideoElapsedS}
        durationS={LAUNCH_VIDEO_DURATION_S}
        cursor={virtualCursor}
        hasCustomMp3={Boolean(voiceoverAudioUrl)}
        mp3FileName={voiceoverFileName}
        onStopDemo={handleStopLaunchVideo}
      />

      {/* 1. COMPACT WORKBENCH TOOLBAR (h-12 w-full) */}
      <DeltaGuardTopBar
        layoutPreset={layoutPreset}
        onChangeLayoutPreset={handleChangeLayoutPreset}
        isPatchedSafe={isPatchedSafe}
        failedCount={Math.max(totalFailedOrWarnCount, 3)}
        totalCasesCount={ADAS_SCENARIOS.length + diffOutput.scenarios.length}
        stagedPackageLabel={stagedPackageLabel}
        isRunningSuite={isRunningSuite}
        isPatching={isPatching}
        isGeneratingAudio={isGeneratingAudio}
        onOpenStageDrawer={() => setIsStageDrawerOpen(true)}
        onRunSilTestSuite={handleRunSilTestSuite}
        onAutoPatchAndVerify={() => handleApplyPatchMode('apply_fix', true)}
        onRestoreBrokenV2={() => handleApplyPatchMode('restore_regressions', false)}
        onPlayAudioAlert={handlePlayAudioAlert}
        onExportReport={handleExportReport}
        onBackToLanding={() => {
          handleStopLaunchVideo();
          setIsPlaying(false);
          setActiveAppView('landing');
        }}
        hasVoiceoverMp3={Boolean(voiceoverAudioUrl)}
        voiceoverFileName={voiceoverFileName}
        onAttachVoiceoverMp3={handleAttachVoiceoverMp3}
        isLaunchVideoPlaying={isLaunchVideoPlaying}
        onPlayLaunchVideo={handlePlayLaunchVideo}
        onStopLaunchVideo={handleStopLaunchVideo}
      />

      {/* 2. 4-PANEL FOXGLOVE STUDIO DOCKED WORKBENCH GRID (calc(100vh - 88px)) */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        {/* PANEL 1 (Left Column, w-72): AUTOMATED TEST RUNNER MATRIX (Vector CANoe Style) */}
        <DeltaGuardSidebar
          activeModelDomain={activeModelDomain}
          onChangeModelDomain={(domain) => {
            setActiveModelDomain(domain);
            setWorldMode(domain === 'adas' ? 'adas_track' : 'bms_pack');
            setIsPlaying(false);
            setPlaybackTimeS(0);
          }}
          adasScenarios={ADAS_SCENARIOS}
          selectedAdasScenarioId={selectedAdasScenarioId}
          onSelectAdasScenario={(id) => {
            setSelectedAdasScenarioId(id);
            setActiveModelDomain('adas');
            setWorldMode('adas_track');
            setIsPlaying(false);
            setPlaybackTimeS(0);
          }}
          baselinePkg={baselinePkg}
          candidatePkg={candidatePkg}
          bmsScenarios={diffOutput.scenarios}
          selectedBmsScenarioId={activeBmsScenarioEntry.scenario.id}
          onSelectBmsScenario={(id) => {
            setSelectedBmsScenarioId(id);
            setActiveModelDomain('bms');
            setWorldMode('bms_pack');
            setIsPlaying(false);
            setPlaybackTimeS(0);
          }}
          rulebook={rulebook}
          isPatchedSafe={isPatchedSafe}
        />

        {/* CENTER STACK: PANEL 2 (3D Technical Vector Viewport) + PANEL 3 (3-Channel Live Oscilloscope) */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* PANEL 2 (Center-Top, flex-1): FOXGLOVE 3D TECHNICAL VECTOR VIEWPORT */}
          <SimulinkWorld3DView
            worldMode={worldMode}
            onChangeWorldMode={(mode) => {
              setWorldMode(mode);
              setActiveModelDomain(mode === 'adas_track' ? 'adas' : 'bms');
              setIsPlaying(false);
              setPlaybackTimeS(0);
            }}
            adasRun={adasComparisonRun}
            baselinePkg={baselinePkg}
            candidatePkg={candidatePkg}
            bmsScenarioEntry={activeBmsScenarioEntry}
            playbackTimeS={playbackTimeS}
            onChangePlaybackTimeS={setPlaybackTimeS}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            cameraPreset={cameraPreset}
            isPatchedSafe={isPatchedSafe}
          />

          {/* PANEL 3 (Center-Bottom, h-52): SYNCHRONIZED MULTI-CHANNEL OSCILLOSCOPE */}
          <LiveOscilloscopeDock
            activeModelDomain={activeModelDomain}
            adasRun={adasComparisonRun}
            bmsScenarioEntry={activeBmsScenarioEntry}
            playbackTimeS={playbackTimeS}
            onChangePlaybackTimeS={setPlaybackTimeS}
            isHighlighted={isScopesHighlighted}
          />
        </main>

        {/* PANEL 4 (Right Column, w-96): REA BINARY DISASSEMBLER & AI HOMOLOGATION GATE */}
        <RightInspectorPanel
          activeModelDomain={activeModelDomain}
          adasRun={adasComparisonRun}
          bmsScenarioEntry={activeBmsScenarioEntry}
          reaAnalysis={reaAnalysis}
          auditReport={auditReport}
          isPatchedSafe={isPatchedSafe}
          onOpenPatchModal={() => setIsPatchModalOpen(true)}
          onRestoreRegressions={() =>
            handleApplyPatchMode('restore_regressions', false)
          }
          onOpenFullBinaryModal={() => setIsFullInspectorOpen(true)}
          isPatching={isPatching}
          crimsonDiffHighlight={isCrimsonDiffHighlighted}
        />
      </div>

      {/* 3. DOCKED BOTTOM TIMELINE SCRUBBER (h-10 w-full bg-slate-900) */}
      <DockedTimelineBar
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onResetPlayback={() => {
          setIsPlaying(false);
          setPlaybackTimeS(0);
        }}
        onStepFrame={() => {
          setIsPlaying(false);
          const stepDelta = activeModelDomain === 'adas' ? 0.1 : durationS / 60;
          setPlaybackTimeS((prev) => Math.min(durationS, prev + stepDelta));
        }}
        playbackTimeS={playbackTimeS}
        durationS={durationS}
        onChangePlaybackTimeS={setPlaybackTimeS}
        playbackSpeed={playbackSpeed}
        onChangePlaybackSpeed={setPlaybackSpeed}
        cameraPreset={cameraPreset}
        onChangeCameraPreset={setCameraPreset}
        anomalyTimesS={anomalyTimesS}
        isPatchedSafe={isPatchedSafe}
      />

      {/* Quick-Stage OTA Upload Drawer ([⬆ Load OTA JSON]) */}
      <QuickStageOtaDrawer
        isOpen={isStageDrawerOpen}
        onClose={() => setIsStageDrawerOpen(false)}
        stagedLabel={stagedPackageLabel}
        v2SourceC={v2SourceC}
        onStageBrokenSupplierV2={async () => {
          await handleApplyPatchMode('restore_regressions', false);
        }}
        onStagePatchedSafeV2={async () => {
          await handleApplyPatchMode('apply_fix', false);
        }}
        onStageCustomCSource={handleStageCustomCSource}
        onStageCustomAdasPackage={(pkg, label) => {
          setCandidatePkg(pkg);
          setStagedPackageLabel(label);
          setActiveModelDomain('adas');
          setWorldMode('adas_track');
          setIsPlaying(false);
          setPlaybackTimeS(0);
        }}
      />

      {/* Auto-Generate Safe Firmware Patch Preview Modal */}
      <PatchPreviewModal
        isOpen={isPatchModalOpen}
        onClose={() => setIsPatchModalOpen(false)}
        onConfirmApplyPatch={() => handleApplyPatchMode('apply_fix', true)}
        isApplying={isPatching}
      />

      {/* Full-Screen ELF64 Disassembly & 10-Scenario BMS Matrix Modal */}
      {isFullInspectorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="h-11 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectorTab('rea_diff')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    inspectorTab === 'rea_diff'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Full REA ELF64 Disassembly &amp; Symbol Inspector</span>
                </button>
                <button
                  onClick={() => setInspectorTab('bms_matrix')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    inspectorTab === 'bms_matrix'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Full 10-Scenario BMS Homologation Matrix</span>
                </button>
              </div>
              <button
                onClick={() => setIsFullInspectorOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {inspectorTab === 'rea_diff' ? (
                <ReaBinaryDiffView
                  reaAnalysis={reaAnalysis}
                  auditReport={auditReport}
                  v1SourceC={v1SourceC}
                  v2SourceC={v2SourceC}
                  onApplyPatchMode={(m) => handleApplyPatchMode(m, true)}
                  isPatching={isPatching}
                />
              ) : (
                <ScenarioMatrixView
                  diffOutput={diffOutput}
                  rulebook={rulebook}
                  selectedScenarioId={activeBmsScenarioEntry.scenario.id}
                  onSelectScenarioAndInspect={(id) => {
                    setSelectedBmsScenarioId(id);
                    setActiveModelDomain('bms');
                    setWorldMode('bms_pack');
                    setIsFullInspectorOpen(false);
                    setPlaybackTimeS(0);
                    setIsPlaying(false);
                  }}
                  onJumpToBinaryDiff={() => setInspectorTab('rea_diff')}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
