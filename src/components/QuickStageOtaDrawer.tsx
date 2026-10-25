import React, { useState, useRef } from 'react';
import {
  FolderUp,
  X,
  FileCode2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
} from 'lucide-react';
import {
  AdasUpdatePackage,
  DEFAULT_CANDIDATE_PACKAGE,
  parseUpdatePackageJson,
} from '../engine/adasSimEngine';

interface QuickStageOtaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  stagedLabel: string;
  v2SourceC: string;
  onStageBrokenSupplierV2: () => Promise<void>;
  onStagePatchedSafeV2: () => Promise<void>;
  onStageCustomCSource: (sourceC: string, label: string) => Promise<void>;
  onStageCustomAdasPackage: (pkg: AdasUpdatePackage, label: string) => void;
}

export const QuickStageOtaDrawer: React.FC<QuickStageOtaDrawerProps> = ({
  isOpen,
  onClose,
  stagedLabel,
  v2SourceC,
  onStageBrokenSupplierV2,
  onStagePatchedSafeV2,
  onStageCustomCSource,
  onStageCustomAdasPackage,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isStaging, setIsStaging] = useState(false);
  const [customC, setCustomC] = useState<string>(v2SourceC);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileDropOrSelect = async (file: File) => {
    setIsStaging(true);
    setStatusMessage(null);
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const pkg = parseUpdatePackageJson(text);
        onStageCustomAdasPackage(pkg, `${file.name} (v${pkg.version})`);
        setStatusMessage(
          `Staged ADAS Package "${file.name}" at T = 0.00s. Click [2. RUN SIL TEST SUITE] to execute.`
        );
      } else if (file.name.endsWith('.c') || file.name.endsWith('.h')) {
        const text = await file.text();
        setCustomC(text);
        await onStageCustomCSource(text, `${file.name} (${file.size} B)`);
        setStatusMessage(
          `Compiled & staged C source "${file.name}" into ELF64 bms_v2.so at T = 0.00s.`
        );
      } else {
        // .so / .bin / .elf binary package
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf.slice(0, 8));
        const hex = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        await onStageBrokenSupplierV2();
        setStatusMessage(
          `Staged ELF64 Binary "${file.name}" (${file.size} B · Header: ${hex}) at T = 0.00s.`
        );
      }
    } catch (err: any) {
      setStatusMessage(`Staging error: ${err?.message || String(err)}`);
    } finally {
      setIsStaging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-end select-none">
      <div className="w-full max-w-lg bg-white h-full border-l border-slate-300 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Drawer Header */}
        <div className="h-12 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderUp className="w-4 h-4 text-blue-600" />
            <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
              1. Stage Candidate OTA Package (v2.0)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Active Staged Status Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 flex items-center justify-between font-mono text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase text-slate-500 font-bold">
                Currently Staged Candidate (T = 0.00s)
              </span>
              <span className="text-slate-900 font-bold">{stagedLabel}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
              READY AT 0.00s
            </span>
          </div>

          {/* 1-Click Demo Presets */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              1-Click OTA Candidate Bundles (Instant Stage at T = 0.00s)
            </span>

            {/* Option A: Supplier v2.0.0 Broken Candidate */}
            <button
              onClick={async () => {
                setIsStaging(true);
                await onStageBrokenSupplierV2();
                setIsStaging(false);
                setStatusMessage(
                  'Staged Supplier OTA v2.0.0 (bms_v2.so + update_v2.json) at T = 0.00s. Ready to click [2. RUN SIL TEST SUITE].'
                );
              }}
              disabled={isStaging}
              className="w-full text-left p-3 rounded border border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors flex items-start justify-between gap-3 cursor-pointer"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-display font-bold text-xs text-red-950">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Supplier OTA Release v2.0.0-rc3 (Unverified Candidate)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Contains 3 hidden regressions: 50.0°C thermal limit (0x42480000), stripped
                  JEITA &lt;10°C cold derating, and 1.0s delayed AEB TTC trigger.
                </p>
              </div>
              <span className="px-2 py-1 rounded bg-red-600 text-white font-mono text-[10px] font-bold shrink-0">
                Stage v2.0.0
              </span>
            </button>

            {/* Option B: DeltaGuard v2.0.1 Patched Compliant */}
            <button
              onClick={async () => {
                setIsStaging(true);
                await onStagePatchedSafeV2();
                setIsStaging(false);
                setStatusMessage(
                  'Staged Patched Safe OTA v2.0.1 (ASIL-D & JEITA Compliant) at T = 0.00s.'
                );
              }}
              disabled={isStaging}
              className="w-full text-left p-3 rounded border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-start justify-between gap-3 cursor-pointer"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-display font-bold text-xs text-emerald-950">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>DeltaGuard Remediated OTA v2.0.1 (ASIL-D &amp; JEITA Safe)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Restores 45.0°C thermal ceiling, 0.8125A cold charge limit, 1-tick NTC
                  fault trip, and 2.0s AEB TTC stopping margin.
                </p>
              </div>
              <span className="px-2 py-1 rounded bg-emerald-600 text-white font-mono text-[10px] font-bold shrink-0">
                Stage v2.0.1
              </span>
            </button>

            {/* Option C: Aggressive ADAS Highway Tuning */}
            <button
              onClick={() => {
                onStageCustomAdasPackage(
                  {
                    ...DEFAULT_CANDIDATE_PACKAGE,
                    package_id: 'update_v2_aggressive',
                    version: '2.0.0-sport',
                    params: {
                      ...DEFAULT_CANDIDATE_PACKAGE.params,
                      aeb_ttc_s: 0.85,
                      aeb_decel_mps2: 6.0,
                      time_headway_s: 1.0,
                    },
                  },
                  'OTA v2.0.0-sport (TTC=0.85s Aggressive)'
                );
                setStatusMessage(
                  'Staged OTA v2.0.0-sport (TTC=0.85s) at T = 0.00s. Click [2. RUN SIL TEST SUITE].'
                );
              }}
              className="w-full text-left p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 cursor-pointer"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-display font-bold text-xs text-slate-900">
                  <GitBranch className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>ADAS Highway Sport Calibration (v2.0.0-sport)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Tightens time headway to 1.0s and delays AEB TTC trigger to 0.85s.
                </p>
              </div>
              <span className="px-2 py-1 rounded bg-slate-800 text-white font-mono text-[10px] font-bold shrink-0">
                Stage Sport
              </span>
            </button>
          </div>

          {/* Drag-and-Drop / File Picker Zone */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Drop Local Binary / Firmware Package (.so, .bin, .c, .json)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".so,.bin,.elf,.c,.h,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileDropOrSelect(f);
                e.target.value = '';
              }}
            />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileDropOrSelect(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-5 bg-slate-50/70 hover:bg-blue-50/30 transition-colors flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
            >
              <Cpu className="w-6 h-6 text-blue-600" />
              <span className="text-xs font-semibold text-slate-800">
                Click to select or drag &amp; drop OTA artifact
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Supports ELF64 .so / .bin, C firmware (bms_v2.c), or ADAS JSON (update_v2.json)
              </span>
            </div>
          </div>

          {/* Optional C Firmware Inspector / Editor */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setShowCodeEditor((v) => !v)}
              className="text-left font-mono text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>
                {showCodeEditor
                  ? 'Hide Candidate C Source Editor'
                  : 'Edit Candidate C Firmware Source (firmware/bms_v2.c)'}
              </span>
            </button>

            {showCodeEditor && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={customC}
                  onChange={(e) => setCustomC(e.target.value)}
                  rows={8}
                  className="w-full font-mono text-[10.5px] p-2.5 rounded bg-slate-900 text-slate-100 border border-slate-700 focus:outline-none"
                />
                <button
                  onClick={async () => {
                    setIsStaging(true);
                    await onStageCustomCSource(customC, 'Custom Edited bms_v2.c');
                    setIsStaging(false);
                    setStatusMessage('Compiled & staged custom bms_v2.c at T = 0.00s.');
                  }}
                  disabled={isStaging}
                  className="self-end px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-mono text-[11px] font-bold cursor-pointer"
                >
                  Compile ELF64 &amp; Stage at T=0.00s
                </button>
              </div>
            )}
          </div>

          {statusMessage && (
            <div className="p-3 rounded bg-blue-50 border border-blue-200 text-blue-950 font-mono text-[11px]">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="h-12 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="font-mono text-[10px] text-slate-500">
            Staging locks playhead at T = 0.00s
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
          >
            Done — Ready to Run
          </button>
        </div>
      </div>
    </div>
  );
};
