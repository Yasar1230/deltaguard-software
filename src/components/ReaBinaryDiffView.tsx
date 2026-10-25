import React, { useState, useRef } from 'react';
import {
  ReaBinaryAnalysis,
  HomologationAuditReport,
} from '../types/deltaguard';
import {
  Cpu,
  Volume2,
  Sparkles,
  Wrench,
  RotateCcw,
  FileCode2,
  Binary,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ReaBinaryDiffViewProps {
  reaAnalysis: ReaBinaryAnalysis;
  auditReport: HomologationAuditReport;
  v1SourceC: string;
  v2SourceC: string;
  onApplyPatchMode: (mode: 'apply_fix' | 'restore_regressions') => Promise<void>;
  isPatching: boolean;
}

export const ReaBinaryDiffView: React.FC<ReaBinaryDiffViewProps> = ({
  reaAnalysis,
  auditReport,
  v1SourceC,
  v2SourceC,
  onApplyPatchMode,
  isPatching,
}) => {
  const [subView, setSubView] = useState<'asm' | 'rodata' | 'csource' | 'elf'>('asm');
  const [aiAuditText, setAiAuditText] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [audioEngineLabel, setAudioEngineLabel] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleRunGeminiAudit = async () => {
    setIsGeneratingAi(true);
    try {
      const resp = await fetch('/api/deltaguard/ai-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await resp.text();
      if (!text.trim().startsWith('<')) {
        const data = JSON.parse(text);
        const formatted =
          data.aiAuditMarkdown ||
          [
            data.headlineVerdict ? `[VERDICT] ${data.headlineVerdict}` : '',
            data.technicalAnalysis || '',
            Array.isArray(data.assemblyCitations)
              ? `\nAssembly Citations:\n- ${data.assemblyCitations.join('\n- ')}`
              : '',
            data.signoffRecommendation
              ? `\nSign-off Recommendation: ${data.signoffRecommendation}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n');
        setAiAuditText(formatted || auditReport.executive_summary);
      } else {
        setAiAuditText(auditReport.executive_summary);
      }
    } catch {
      setAiAuditText(auditReport.executive_summary);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleGenerateTtsBriefing = async () => {
    setIsGeneratingAudio(true);
    try {
      const resp = await fetch('/api/deltaguard/tts-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: auditReport.audio_briefing_script,
        }),
      });
      const text = await resp.text();
      if (!text.trim().startsWith('<')) {
        const data = JSON.parse(text);
        const uri = data.audioDataUri || data.audioDataUrl;
        if (uri) {
          setAudioDataUri(uri);
          setAudioEngineLabel(data.engine || data.provider || 'Gemini TTS');
          setTimeout(() => {
            audioRef.current?.play().catch(() => {});
          }, 120);
        }
      }
    } catch {
      // Fallback handled silently
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Binary Identity + AI Briefing & Live Patch Bar */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Cpu className="w-4 h-4 text-[#2563EB]" />
            <h1 className="font-display font-bold text-base text-[#0F172A]">
              REA x86-64 Binary Disassembly & Homologation Root-Cause Correlator
            </h1>
            <span className="text-[#CBD5E1]">·</span>
            <span className="font-mono text-xs text-[#475569]">
              Provider: {reaAnalysis.mcp_provider}
            </span>
          </div>
          <div className="font-mono text-[11px] text-[#64748B] tabular-nums flex items-center gap-3 flex-wrap">
            <span>
              bms_v1.so ({reaAnalysis.binaries.v1_size} B · SHA256 {reaAnalysis.binaries.v1_sha256.slice(0, 14)}…)
            </span>
            <span>vs</span>
            <span>
              bms_v2.so ({reaAnalysis.binaries.v2_size} B · SHA256 {reaAnalysis.binaries.v2_sha256.slice(0, 14)}…)
            </span>
          </div>
        </div>

        {/* Interactive Remediation & AI Briefing Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGenerateTtsBriefing}
            disabled={isGeneratingAudio}
            className="px-3 py-1.5 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>
              {isGeneratingAudio ? 'Synthesizing Audio...' : 'Play Audio Safety Briefing'}
            </span>
          </button>

          <button
            onClick={handleRunGeminiAudit}
            disabled={isGeneratingAi}
            className="px-3 py-1.5 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isGeneratingAi ? 'Running Gemini Audit...' : 'Generate Gemini ASIL-D Audit'}
            </span>
          </button>

          <button
            onClick={() => onApplyPatchMode('apply_fix')}
            disabled={isPatching}
            className="px-3 py-1.5 rounded bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{isPatching ? 'Compiling ELF64...' : 'Patch bms_v2.c to Pass Gate'}</span>
          </button>

          <button
            onClick={() => onApplyPatchMode('restore_regressions')}
            disabled={isPatching}
            className="px-3 py-1.5 rounded bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Supplier v2.4.1 Bugs</span>
          </button>
        </div>
      </div>

      {/* Audio Briefing Player Strip */}
      {audioDataUri && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-md p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#1D4ED8]">
              <Volume2 className="w-4 h-4" />
              <span>EXECUTIVE AUDIO HOMOLOGATION BRIEFING ({audioEngineLabel})</span>
            </div>
            <p className="text-xs text-[#1E3A8A] leading-relaxed max-w-[85ch]">
              “{auditReport.audio_briefing_script}”
            </p>
          </div>
          <audio
            ref={audioRef}
            controls
            src={audioDataUri}
            className="h-9 shrink-0"
          />
        </div>
      )}

      {/* Gemini Live AI Audit Report Output */}
      {aiAuditText && (
        <div className="bg-[#FFFFFF] border border-[#BFDBFE] rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-[#1D4ED8]">
              Gemini Chief Functional Safety Auditor Memo (ISO 26262 / JEITA / IEC 62660-2)
            </span>
            <button
              onClick={() => setAiAuditText(null)}
              className="text-xs font-mono text-[#64748B] hover:text-[#0F172A] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3.5 leading-relaxed">
            {aiAuditText}
          </pre>
        </div>
      )}

      {/* 3 Binary-to-Physics Root Cause Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {auditReport.correlations.map((corr) => (
          <div
            key={corr.id}
            className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-col justify-between gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="font-bold text-[#DC2626] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{corr.rule_id}</span>
                </span>
                <span className="text-[#475569] font-semibold">{corr.scenario_id}</span>
              </div>
              <div className="font-display font-bold text-xs text-[#0F172A]">
                {corr.standard}
              </div>
              <div className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded px-2.5 py-1.5 font-medium">
                {corr.deceptive_metric}
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                <strong className="text-[#0F172A]">Physical Anomaly:</strong> {corr.physical_anomaly}
              </p>
              <div className="font-mono text-[11px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2">
                <span className="text-[#64748B] block text-[10px] uppercase">
                  REA x86-64 Disassembly Evidence:
                </span>
                {corr.binary_root_cause}
              </div>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0]">
              <span className="font-mono text-[10px] uppercase text-[#16A34A] font-bold block mb-1">
                Recommended C Firmware Patch:
              </span>
              <pre className="font-mono text-[10.5px] text-[#0F172A] bg-[#F0FDF4] border border-[#BBF7D0] rounded p-2 overflow-x-auto">
                {corr.recommended_c_patch}
              </pre>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-Navigation for Side-by-Side Inspection */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md overflow-hidden">
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSubView('asm')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer ${
                subView === 'asm'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#FFFFFF] text-[#475569] border border-[#CBD5E1]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>objdump -d -M intel (&lt;bms_step&gt;)</span>
            </button>

            <button
              onClick={() => setSubView('rodata')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer ${
                subView === 'rodata'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#FFFFFF] text-[#475569] border border-[#CBD5E1]'
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              <span>.rodata IEEE-754 Float Table & Hex Dump</span>
            </button>

            <button
              onClick={() => setSubView('csource')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer ${
                subView === 'csource'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#FFFFFF] text-[#475569] border border-[#CBD5E1]'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>C Source Diff (bms_v1.c vs bms_v2.c)</span>
            </button>

            <button
              onClick={() => setSubView('elf')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer ${
                subView === 'elf'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#FFFFFF] text-[#475569] border border-[#CBD5E1]'
              }`}
            >
              <span>ELF64 Symbol & Section Headers (nm -D / readelf -S)</span>
            </button>
          </div>

          <span className="font-mono text-[11px] text-[#64748B]">
            x86-64 System V ABI · SSE2 Scalar Floating-Point Instructions
          </span>
        </div>

        {/* Subview 1: Side-by-side x86-64 Assembly Diff */}
        {subView === 'asm' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-[#2563EB] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>BASELINE: firmware/bms_v1.so (&lt;bms_step&gt;)</span>
                </span>
                <span className="font-mono text-[11px] text-[#64748B]">
                  45.0°C Cutoff · 0.8125A Cold Derate · Immediate NTC Fault Trip
                </span>
              </div>
              <pre className="font-mono text-[11.5px] leading-relaxed text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3 overflow-x-auto">
                {reaAnalysis.v1_bms_step_asm}
                {'\n\n'}
                {reaAnalysis.v1_helper_asm}
              </pre>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-[#DC2626] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>CANDIDATE: firmware/bms_v2.so (&lt;bms_step&gt;)</span>
                </span>
                <span className="font-mono text-[11px] text-[#DC2626]">
                  50.0°C Cutoff · Cold Branch Removed · comisd SoC≥0.80 Gate
                </span>
              </div>
              <pre className="font-mono text-[11.5px] leading-relaxed text-[#0F172A] bg-[#FEF2F2]/40 border border-[#FECACA] rounded p-3 overflow-x-auto">
                {reaAnalysis.v2_bms_step_asm}
                {'\n\n'}
                {reaAnalysis.v2_helper_asm}
              </pre>
            </div>
          </div>
        )}

        {/* Subview 2: .rodata IEEE-754 Float Table & Hex Dump */}
        {subView === 'rodata' && (
          <div className="p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h3 className="font-mono text-xs font-bold text-[#2563EB] mb-2">
                  firmware/bms_v1.so · .rodata IEEE-754 Constants
                </h3>
                <table className="w-full text-left border-collapse font-mono text-xs tabular-nums border border-[#E2E8F0]">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] uppercase text-[#64748B]">
                      <th className="p-2">Offset</th>
                      <th className="p-2">Float Value</th>
                      <th className="p-2">IEEE-754 Hex</th>
                      <th className="p-2">LE Bytes</th>
                      <th className="p-2">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {reaAnalysis.v1_rodata_floats.map((f, i) => (
                      <tr key={i}>
                        <td className="p-2 text-[#64748B]">{f.file_offset}</td>
                        <td className="p-2 font-bold text-[#2563EB]">{f.value}</td>
                        <td className="p-2 text-[#0F172A]">{f.ieee754_hex}</td>
                        <td className="p-2 text-[#475569]">{f.little_endian_bytes}</td>
                        <td className="p-2 font-sans text-xs text-[#0F172A]">{f.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <pre className="mt-3 font-mono text-[11px] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3 overflow-x-auto">
                  {reaAnalysis.v1_rodata_dump}
                </pre>
              </div>

              <div>
                <h3 className="font-mono text-xs font-bold text-[#DC2626] mb-2">
                  firmware/bms_v2.so · .rodata IEEE-754 Constants
                </h3>
                <table className="w-full text-left border-collapse font-mono text-xs tabular-nums border border-[#FECACA]">
                  <thead>
                    <tr className="bg-[#FEF2F2] border-b border-[#FECACA] text-[10px] uppercase text-[#991B1B]">
                      <th className="p-2">Offset</th>
                      <th className="p-2">Float Value</th>
                      <th className="p-2">IEEE-754 Hex</th>
                      <th className="p-2">LE Bytes</th>
                      <th className="p-2">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FECACA]">
                    {reaAnalysis.v2_rodata_floats.map((f, i) => (
                      <tr key={i} className={f.value === 50.0 ? 'bg-[#FEF2F2]' : ''}>
                        <td className="p-2 text-[#64748B]">{f.file_offset}</td>
                        <td className="p-2 font-bold text-[#DC2626]">{f.value}</td>
                        <td className="p-2 text-[#0F172A]">{f.ieee754_hex}</td>
                        <td className="p-2 text-[#475569]">{f.little_endian_bytes}</td>
                        <td className="p-2 font-sans text-xs text-[#0F172A]">{f.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <pre className="mt-3 font-mono text-[11px] bg-[#FEF2F2]/40 border border-[#FECACA] rounded p-3 overflow-x-auto">
                  {reaAnalysis.v2_rodata_dump}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Subview 3: C Firmware Source Diff */}
        {subView === 'csource' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">
            <div className="p-4">
              <div className="font-mono text-xs font-bold text-[#2563EB] mb-2">
                firmware/bms_v1.c (Production Baseline v1.0.0)
              </div>
              <pre className="font-mono text-[11.5px] leading-relaxed text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3 overflow-x-auto">
                {v1SourceC}
              </pre>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs font-bold text-[#DC2626] mb-2">
                firmware/bms_v2.c (Candidate OTA v2.4.1-rc3)
              </div>
              <pre className="font-mono text-[11.5px] leading-relaxed text-[#0F172A] bg-[#FEF2F2]/30 border border-[#FECACA] rounded p-3 overflow-x-auto">
                {v2SourceC}
              </pre>
            </div>
          </div>
        )}

        {/* Subview 4: ELF64 Dynamic Symbol Table & Section Headers */}
        {subView === 'elf' && (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="font-mono text-xs font-bold text-[#0F172A] mb-2">
                Dynamic Symbol Table (nm -D firmware/bms_v1.so & bms_v2.so)
              </div>
              <pre className="font-mono text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3">
                {reaAnalysis.v1_symbols}
              </pre>
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-[#0F172A] mb-2">
                ELF64 Section Header Table (readelf -S firmware/bms_v1.so)
              </div>
              <pre className="font-mono text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3 overflow-x-auto">
                {reaAnalysis.v1_sections}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
