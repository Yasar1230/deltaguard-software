import React, { useState } from 'react';
import {
  Agent37SandboxReceipt,
  GithubUpstreamSnippet,
} from '../types/deltaguard';
import {
  UploadCloud,
  Server,
  GitBranch,
  Play,
  CheckCircle2,
  FileCode,
  Shield,
  Terminal,
} from 'lucide-react';

interface OtaReleaseGateViewProps {
  v2SourceC: string;
  lastSandboxReceipt: Agent37SandboxReceipt | null;
  onCompileAndRunOta: (sourceC: string, workspaceUrl: string) => Promise<void>;
  isSubmittingOta: boolean;
}

export const OtaReleaseGateView: React.FC<OtaReleaseGateViewProps> = ({
  v2SourceC,
  lastSandboxReceipt,
  onCompileAndRunOta,
  isSubmittingOta,
}) => {
  const [editableCSource, setEditableCSource] = useState<string>(v2SourceC);
  const [workspaceUrl, setWorkspaceUrl] = useState<string>(
    'https://www.agent37.com/dashboard/cloud'
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [githubSnippet, setGithubSnippet] = useState<GithubUpstreamSnippet | null>(null);
  const [isFetchingGithub, setIsFetchingGithub] = useState(false);

  const [reaMcpFileContent, setReaMcpFileContent] = useState<string | null>(null);
  const [selectedReaFile, setSelectedReaFile] = useState<string>('tools-Static_Analysis.md');

  // Sync when parent updates v2SourceC (e.g. via patch button)
  React.useEffect(() => {
    setEditableCSource(v2SourceC);
  }, [v2SourceC]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(`${file.name} (${file.size} bytes)`);
    if (file.name.endsWith('.c') || file.name.endsWith('.h') || file.name.endsWith('.txt')) {
      const text = await file.text();
      setEditableCSource(text);
    } else {
      // Binary .so / .elf uploaded: read header bytes and trigger gate run
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 16));
      const hexHeader = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      setUploadedFileName(`${file.name} (${file.size} B · ELF Header: ${hexHeader})`);
    }
  };

  const handleFetchGithub = async () => {
    setIsFetchingGithub(true);
    try {
      const resp = await fetch('/api/deltaguard/fetch-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await resp.text();
      if (!text.trim().startsWith('<')) {
        const data = JSON.parse(text);
        setGithubSnippet(data);
      }
    } catch {
      // Ignore if offline
    } finally {
      setIsFetchingGithub(false);
    }
  };

  const handleLoadReaFile = async (filePath: string) => {
    setSelectedReaFile(filePath);
    try {
      const resp = await fetch(`/api/mcp/file?path=${encodeURIComponent(filePath)}`);
      const text = await resp.text();
      if (!text.trim().startsWith('<')) {
        const data = JSON.parse(text);
        if (data.content) {
          setReaMcpFileContent(data.content);
        }
      }
    } catch {
      // Ignore if offline
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Gate Header & Agent37 Sandbox Connection Bar */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[#2563EB]" />
            <h1 className="font-display font-bold text-base text-[#0F172A]">
              OTA Firmware Release Gate & Agent37 Isolated Sandbox Dispatcher
            </h1>
          </div>
          <p className="text-xs text-[#475569]">
            Upload or edit candidate C/ELF64 firmware (`firmware/bms_v2.c` → `firmware/bms_v2.so`), dispatch execution to Agent37 Cloud Sandbox, and re-verify all 10 hardware scenarios.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded px-3 py-1.5">
            <Server className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="font-mono text-[11px] text-[#64748B]">Agent37 Endpoint:</span>
            <input
              type="text"
              value={workspaceUrl}
              onChange={(e) => setWorkspaceUrl(e.target.value)}
              className="font-mono text-xs text-[#0F172A] bg-transparent focus:outline-none w-64"
            />
          </div>

          <button
            onClick={() => onCompileAndRunOta(editableCSource, workspaceUrl)}
            disabled={isSubmittingOta}
            className="px-3.5 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {isSubmittingOta
                ? 'Compiling ELF64 & Running SIL...'
                : 'Compile ELF64 & Execute in Agent37 Sandbox'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Split: Candidate Firmware Editor/Uploader (Left) + Agent37 Sandbox Receipt & Upstream GitHub Safety Code (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left 7 Columns: Live Candidate Firmware C Editor & Binary Uploader */}
        <div className="xl:col-span-7 bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-[#2563EB]" />
              <h2 className="font-display font-bold text-xs uppercase tracking-wider text-[#0F172A]">
                Candidate OTA Source (`firmware/bms_v2.c` → ELF64 `bms_v2.so`)
              </h2>
            </div>

            <label className="px-3 py-1 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] font-mono text-xs font-medium cursor-pointer flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Upload .c / .so / .elf</span>
              <input
                type="file"
                accept=".c,.h,.so,.elf,.bin"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {uploadedFileName && (
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded px-3 py-1.5 font-mono text-xs text-[#1D4ED8] flex items-center justify-between">
              <span>Loaded Artifact: {uploadedFileName}</span>
              <button
                onClick={() => setUploadedFileName(null)}
                className="text-[11px] underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          <div className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded px-3 py-2 font-mono">
            Tip: Edit <code className="text-[#DC2626] font-bold">#define MAX_TEMP_CUTOFF_C 50.0f</code> to{' '}
            <code className="text-[#16A34A] font-bold">45.0f</code>, restore the{' '}
            <code className="text-[#16A34A] font-bold">COLD_TEMP_THRESHOLD_C 10.0f</code> check, and remove{' '}
            <code className="text-[#DC2626] font-bold">&amp;&amp; state-&gt;soc &gt;= 0.80</code> to see the compiled x86-64 `.so` pass all 10 scenarios.
          </div>

          <textarea
            value={editableCSource}
            onChange={(e) => setEditableCSource(e.target.value)}
            rows={22}
            spellCheck={false}
            className="w-full font-mono text-xs leading-relaxed text-[#0F172A] bg-[#F8FAFC] border border-[#CBD5E1] rounded p-3 focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        {/* Right 5 Columns: Agent37 Cloud Sandbox Execution Telemetry & Upstream GitHub Fetcher */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Agent37 Sandbox Execution Card */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#16A34A]" />
                <h2 className="font-display font-bold text-xs uppercase tracking-wider text-[#0F172A]">
                  Agent37 Cloud Sandbox Execution Receipt
                </h2>
              </div>
              <span className="font-mono text-[11px] text-[#16A34A] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Isolated</span>
              </span>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3 font-mono text-xs flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Provider:</span>
                <span className="text-[#0F172A] font-semibold">
                  {lastSandboxReceipt?.sandbox_provider ||
                    'Agent37 Cloud Workspace + Local Isolated Runner'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Target Workspace:</span>
                <span className="text-[#2563EB] truncate max-w-[240px]">
                  {lastSandboxReceipt?.workspace_url || workspaceUrl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Isolation Profile:</span>
                <span className="text-[#0F172A]">
                  {lastSandboxReceipt?.isolation_profile ||
                    'gVisor-style Subprocess Isolation'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Execution Latency:</span>
                <span className="text-[#0F172A] tabular-nums">
                  {lastSandboxReceipt ? `${lastSandboxReceipt.execution_time_ms} ms` : '429 ms'}
                </span>
              </div>
            </div>

            {lastSandboxReceipt?.stdout && (
              <div>
                <span className="font-mono text-[10px] uppercase text-[#64748B] block mb-1">
                  Sandbox Stdout Trace:
                </span>
                <pre className="font-mono text-[11px] bg-[#0F172A] text-[#F8FAFC] rounded p-2.5 overflow-x-auto max-h-36">
                  {lastSandboxReceipt.stdout}
                </pre>
              </div>
            )}
          </div>

          {/* Upstream Automotive GitHub Safety Controller Fetcher (commaai/panda) */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#2563EB]" />
                <h2 className="font-display font-bold text-xs uppercase tracking-wider text-[#0F172A]">
                  Upstream Automotive Safety Code (`commaai/panda`)
                </h2>
              </div>
              <button
                onClick={handleFetchGithub}
                disabled={isFetchingGithub}
                className="px-2.5 py-1 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] font-mono text-[11px] font-semibold cursor-pointer"
              >
                {isFetchingGithub ? 'Fetching GitHub...' : 'Fetch Live Safety Code'}
              </button>
            </div>

            <p className="text-xs text-[#475569]">
              Fetches live production automotive safety interceptor logic (`board/safety/safety_hyundai.h`) from `commaai/opendbc` / `commaai/panda` to benchmark CAN torque and contactor safety envelopes.
            </p>

            {githubSnippet && (
              <div className="flex flex-col gap-1.5">
                <div className="font-mono text-[11px] text-[#2563EB] flex items-center justify-between">
                  <span>
                    {githubSnippet.repository} · {githubSnippet.file_path}
                  </span>
                  <span>{githubSnippet.byte_length} bytes</span>
                </div>
                <pre className="font-mono text-[10.5px] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2.5 overflow-x-auto max-h-48 text-[#0F172A]">
                  {githubSnippet.snippet}
                </pre>
              </div>
            )}
          </div>

          {/* Cloned morluto/rea Repository Inspector */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-md p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#2563EB]" />
                <h2 className="font-display font-bold text-xs uppercase tracking-wider text-[#0F172A]">
                  Mounted REA MCP Repository (`/vendor/morluto-rea`)
                </h2>
              </div>
              <div className="flex items-center gap-1">
                {[
                  'tools-Static_Analysis.md',
                  'Prompt.md',
                  'setup_mcp.py',
                ].map((f) => (
                  <button
                    key={f}
                    onClick={() => handleLoadReaFile(f)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer ${
                      selectedReaFile === f && reaMcpFileContent
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#F8FAFC] text-[#475569] border border-[#CBD5E1]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {reaMcpFileContent && (
              <pre className="font-mono text-[10.5px] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2.5 overflow-x-auto max-h-40 text-[#0F172A]">
                {reaMcpFileContent.slice(0, 1800)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
