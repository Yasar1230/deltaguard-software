import React from 'react';
import { X, Wrench, CheckCircle2, Cpu } from 'lucide-react';

interface PatchPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmApplyPatch: () => Promise<void>;
  isApplying: boolean;
}

export const PatchPreviewModal: React.FC<PatchPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirmApplyPatch,
  isApplying,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm text-slate-900">
                Auto-Generated ASIL-D Safe Firmware Patch (v2.0.1)
              </h2>
              <p className="text-xs text-slate-500">
                Remediates all 3 ELF64 BMS binary violations and restores ADAS AEB TTC trigger margin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Unified Diff */}
        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs leading-relaxed border border-slate-800">
            <div className="text-slate-400 mb-2 flex items-center justify-between">
              <span>--- a/firmware/bms_v2.c (Supplier v2.4.1-rc3)</span>
              <span>+++ b/firmware/bms_v2.c (DeltaGuard Safe Patch v2.0.1)</span>
            </div>

            <div className="text-red-400">
              - #define MAX_TEMP_CUTOFF_C 50.0f /* 0x42480000 in .rodata */
            </div>
            <div className="text-emerald-400">
              + #define MAX_TEMP_CUTOFF_C 45.0f /* 0x42340000 IEC 62660-2 Verified */
            </div>

            <div className="mt-2 text-red-400">
              - /* Cold derating branch stripped by supplier */
            </div>
            <div className="text-emerald-400">
              + #define COLD_TEMP_THRESHOLD_C 10.0f
            </div>
            <div className="text-emerald-400">
              + #define COLD_CHARGE_LIMIT_A   0.8125f /* JEITA 0.25C Restored */
            </div>

            <div className="mt-2 text-red-400">
              - if (state-&gt;temp_sensor_fail != 0 &amp;&amp; state-&gt;soc &gt;= 0.80) {'{'}
            </div>
            <div className="text-emerald-400">
              + if (state-&gt;temp_sensor_fail != 0) {'{'} /* Unconditional 1-Tick ASIL-D Trip */
            </div>
            <div className="text-slate-300">
              {'    '}state-&gt;contactor_open = 1;
            </div>
            <div className="text-slate-300">
              {'    '}return 0.0;
            </div>
            <div className="text-slate-300">{'  }'}</div>

            <div className="mt-3 pt-3 border-t border-slate-800 text-slate-400">
              --- a/updates/update_v2.json (ADAS Controller)
            </div>
            <div className="text-red-400">
              - &quot;aeb_ttc_s&quot;: 1.0
            </div>
            <div className="text-emerald-400">
              + &quot;aeb_ttc_s&quot;: 2.0
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 flex items-center gap-3 text-xs text-emerald-950">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Clicking <strong>Apply Patch &amp; Re-Run Simulation</strong> will recompile{' '}
              <code className="font-mono font-bold">firmware/bms_v2.so</code> via the native ELF64 compiler, re-execute all 10 hardware scenarios via <code className="font-mono font-bold">ctypes.CDLL</code>, and update the 3D Digital Twin.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmApplyPatch}
            disabled={isApplying}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>
              {isApplying
                ? 'Compiling ELF64 & Running SIL...'
                : 'Apply Patch & Re-Run Simulation (v2.0.1)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
