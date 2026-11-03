import React, { useRef } from 'react';
import {
  FolderUp,
  Play,
  Sparkles,
  Volume2,
  Download,
  ShieldAlert,
  ShieldCheck,
  LayoutGrid,
  RotateCcw,
  ArrowLeft,
  Music,
  Film,
  CheckCircle2,
  Square,
  Box,
  GitCommit,
  Activity,
  Cpu,
  Layers,
  UploadCloud,
  PanelLeft,
  PanelBottom,
  PanelRight,
} from 'lucide-react';

export type WorkbenchLayoutPreset =
  | 'foxglove_default'
  | 'adas_vector_focus'
  | 'bms_binary_focus';

export type WorkbenchModuleTab =
  | 'studio_3d'
  | 'simulink_diagram'
  | 'oscilloscope_ecu'
  | 'rea_disassembler'
  | 'scenario_matrix'
  | 'ota_sandbox_gate';

interface DeltaGuardTopBarProps {
  layoutPreset: WorkbenchLayoutPreset;
  onChangeLayoutPreset: (preset: WorkbenchLayoutPreset) => void;
  activeModuleTab: WorkbenchModuleTab;
  onChangeModuleTab: (tab: WorkbenchModuleTab) => void;
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  showBottomScopes: boolean;
  onToggleBottomScopes: () => void;
  showRightInspector: boolean;
  onToggleRightInspector: () => void;
  isPatchedSafe: boolean;
  failedCount: number;
  totalCasesCount: number;
  stagedPackageLabel: string;
  isRunningSuite: boolean;
  isPatching: boolean;
  isGeneratingAudio: boolean;
  onOpenStageDrawer: () => void;
  onRunSilTestSuite: () => void;
  onAutoPatchAndVerify: () => void;
  onRestoreBrokenV2: () => void;
  onPlayAudioAlert: () => void;
  onExportReport: () => void;
  onBackToLanding?: () => void;
  hasVoiceoverMp3: boolean;
  voiceoverFileName: string | null;
  onAttachVoiceoverMp3: (file: File) => void;
  isLaunchVideoPlaying: boolean;
  onPlayLaunchVideo: () => void;
  onStopLaunchVideo: () => void;
}

const MODULE_TABS: Array<{
  id: WorkbenchModuleTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'studio_3d',
    label: '1. 3D Digital Twin & Studio',
    shortLabel: '3D Twin Studio',
    icon: Box,
  },
  {
    id: 'simulink_diagram',
    label: '2. Simulink Block Diagram (.slx)',
    shortLabel: 'Simulink .slx',
    icon: GitCommit,
  },
  {
    id: 'oscilloscope_ecu',
    label: '3. 4-Channel Scopes & ECU',
    shortLabel: '4-Ch Scopes',
    icon: Activity,
  },
  {
    id: 'rea_disassembler',
    label: '4. REA ELF64 Disassembler',
    shortLabel: 'ELF64 Diff',
    icon: Cpu,
  },
  {
    id: 'scenario_matrix',
    label: '5. 17-Scenario Matrix & Rules',
    shortLabel: '17-Case Matrix',
    icon: Layers,
  },
  {
    id: 'ota_sandbox_gate',
    label: '6. OTA Gate & Agent37 Sandbox',
    shortLabel: 'Agent37 Gate',
    icon: UploadCloud,
  },
];

export const DeltaGuardTopBar: React.FC<DeltaGuardTopBarProps> = ({
  layoutPreset,
  onChangeLayoutPreset,
  activeModuleTab,
  onChangeModuleTab,
  showLeftSidebar,
  onToggleLeftSidebar,
  showBottomScopes,
  onToggleBottomScopes,
  showRightInspector,
  onToggleRightInspector,
  isPatchedSafe,
  failedCount,
  totalCasesCount,
  stagedPackageLabel,
  isRunningSuite,
  isPatching,
  isGeneratingAudio,
  onOpenStageDrawer,
  onRunSilTestSuite,
  onAutoPatchAndVerify,
  onRestoreBrokenV2,
  onPlayAudioAlert,
  onExportReport,
  onBackToLanding,
  hasVoiceoverMp3,
  voiceoverFileName,
  onAttachVoiceoverMp3,
  isLaunchVideoPlaying,
  onPlayLaunchVideo,
  onStopLaunchVideo,
}) => {
  return (
    <header className="w-full bg-white border-b border-slate-300 flex flex-col shrink-0 select-none z-30">

      {/* ROW 1: Primary Executive & Simulation Action Bar */}
      <div className="min-h-11 w-full px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
        {/* LEFT: [ ← Overview ] + Compact DeltaGuard SIL Logo + Release Gate Pill */}
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              title="Open Foxglove Product Overview Page"
              className="h-7 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3 text-slate-600 shrink-0" />
              <span>Overview</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-sm bg-[#121619] flex items-center justify-center border border-[#343a3f]">
              <svg
                width="13"
                height="13"
                viewBox="0 0 220 234"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M219.294 74.5355L182.97 53.5615C181.941 52.9674 180.673 52.9675 179.644 53.5617L130.303 82.0599V25.0789C130.303 23.8911 129.669 22.7935 128.641 22.1995L92.3161 1.22523C91.2078 0.585325 89.8224 1.38513 89.8224 2.66493V82.0432L40.4808 53.5609C39.4521 52.9671 38.1847 52.9671 37.156 53.5611L0.831225 74.5356C-0.276975 75.1755 -0.276975 76.7751 0.831225 77.415L69.5736 117.104L0.831225 156.794C-0.277075 157.434 -0.277075 159.033 0.831225 159.673L37.156 180.648C38.1847 181.242 39.4521 181.242 40.4808 180.648L89.8224 152.165V209.146C89.8224 210.334 90.4564 211.432 91.4856 212.026L127.81 232.985C128.918 233.624 130.303 232.824 130.303 231.545V152.165L179.644 180.648C180.673 181.241 181.941 181.241 182.969 180.647L219.294 159.673C220.402 159.033 220.402 157.433 219.294 156.794L150.535 117.104L219.294 77.4148C220.402 76.775 220.402 75.1755 219.294 74.5355ZM133.046 130.387L110.054 143.654L87.0792 130.387V103.838L110.054 90.5716L133.046 103.838V130.387Z"
                  fill="#937af6"
                />
              </svg>
            </div>
            <span className="font-display font-bold text-xs sm:text-sm tracking-tight text-slate-900 whitespace-nowrap">
              DeltaGuard SIL
            </span>
          </div>

          {/* Workspace Preset Dropdown */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-sm px-2 py-1 text-[10.5px] font-mono text-slate-700 shrink-0">
            <LayoutGrid className="w-3 h-3 text-[#664fff] shrink-0" />
            <select
              value={layoutPreset}
              onChange={(e) =>
                onChangeLayoutPreset(e.target.value as WorkbenchLayoutPreset)
              }
              className="bg-transparent font-mono text-[10.5px] font-medium text-slate-700 focus:outline-none cursor-pointer"
              aria-label="Workspace Layout Preset"
            >
              <option value="foxglove_default">Foxglove SIL v2.4</option>
              <option value="adas_vector_focus">ADAS Vector Layout</option>
              <option value="bms_binary_focus">BMS &amp; REA Layout</option>
            </select>
          </div>

          {/* Release Gate Status Pill */}
          <div
            className={`px-2 py-0.5 rounded-sm border font-mono text-[10.5px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${
              isPatchedSafe
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}
          >
            {isPatchedSafe ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
            )}
            <span>
              {isPatchedSafe
                ? `OTA v2.0.1: ${totalCasesCount}/${totalCasesCount} PASS [ASIL-D]`
                : `OTA v2.0.0: BLOCKED [${failedCount} FAIL / ASIL-D]`}
            </span>
          </div>
        </div>

        {/* RIGHT / CENTER: Core Workbench Actions + Launch Trailer Engine Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 1. Load OTA JSON / Upload OTA Package */}
          <button
            data-demo-target="load-ota-btn"
            onClick={onOpenStageDrawer}
            title={`Staged: ${stagedPackageLabel}`}
            className="h-7 px-2.5 rounded-sm bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <FolderUp className="w-3.5 h-3.5 text-[#664fff] shrink-0" />
            <span>Load OTA</span>
          </button>

          {/* 2. RUN SIL TEST SUITE */}
          <button
            data-demo-target="run-sil-btn"
            onClick={onRunSilTestSuite}
            disabled={isRunningSuite}
            className="h-7 px-2.5 rounded-sm bg-[#664fff] hover:bg-[#5933f2] disabled:opacity-60 text-white text-[11px] font-bold tracking-wide flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current shrink-0" />
            <span>{isRunningSuite ? 'Running SIL...' : 'Run SIL Suite'}</span>
          </button>

          {/* 3. Auto-Patch Binary & Re-Verify (or Restore Broken v2.0) */}
          {!isPatchedSafe ? (
            <button
              onClick={onAutoPatchAndVerify}
              disabled={isPatching}
              className="h-7 px-2.5 rounded-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{isPatching ? 'Patching...' : 'Auto-Patch & Verify'}</span>
            </button>
          ) : (
            <button
              onClick={onRestoreBrokenV2}
              disabled={isPatching}
              className="h-7 px-2.5 rounded-sm bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-amber-700 shrink-0" />
              <span>Restore Broken v2.0</span>
            </button>
          )}

          {/* Audio Alert + Export Report */}
          <button
            onClick={onPlayAudioAlert}
            disabled={isGeneratingAudio}
            title="Play Executive Audio Alert"
            className="h-7 px-2 rounded-sm bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>{isGeneratingAudio ? 'Speaking...' : 'Audio Alert'}</span>
          </button>

          <button
            onClick={onExportReport}
            title="Export Homologation JSON Report"
            className="h-7 px-2 rounded-sm bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ROW 2: Complete 6-Module Navigation Tabs + Docked Panel Toggles */}
      <div className="min-h-9 w-full px-2.5 py-1 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
        {/* 6 Complete Workbench Modules */}
        <nav
          aria-label="Workbench Modules"
          className="flex items-center gap-1 flex-wrap"
        >
          {MODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeModuleTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeModuleTab(tab.id)}
                className={`h-7 px-2.5 rounded-sm font-sans text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200/90'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? 'text-[#937af6]' : 'text-slate-500'
                  }`}
                />
                <span className="hidden xl:inline">{tab.label}</span>
                <span className="xl:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </nav>

        {/* Docked Panel Visibility Toggles (Active in 3D Digital Twin Studio) */}
        {activeModuleTab === 'studio_3d' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono uppercase text-slate-500 mr-1 hidden sm:inline">
              Panels:
            </span>
            <button
              onClick={onToggleLeftSidebar}
              title="Toggle Left 17-Scenario Test Matrix"
              className={`h-6 px-2 rounded-xs font-mono text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                showLeftSidebar
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
              }`}
            >
              <PanelLeft className="w-3 h-3" />
              <span>Test Matrix</span>
            </button>
            <button
              onClick={onToggleBottomScopes}
              title="Toggle Bottom 3-Channel Live Oscilloscopes"
              className={`h-6 px-2 rounded-xs font-mono text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                showBottomScopes
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
              }`}
            >
              <PanelBottom className="w-3 h-3" />
              <span>Live Scopes</span>
            </button>
            <button
              onClick={onToggleRightInspector}
              title="Toggle Right REA Binary & Safety Verdict Inspector"
              className={`h-6 px-2 rounded-xs font-mono text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                showRightInspector
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
              }`}
            >
              <PanelRight className="w-3 h-3" />
              <span>Inspector</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
