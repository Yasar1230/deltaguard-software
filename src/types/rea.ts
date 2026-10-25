export type ArtifactFormat =
  | 'asar'
  | 'wasm'
  | 'elf'
  | 'pe'
  | 'macho'
  | 'javascript'
  | 'sourcemap'
  | 'raw';

export interface BinarySection {
  name: string;
  offset: number;
  size: number;
  entropy: number;
  flags: string;
  description: string;
}

export interface ArtifactSymbol {
  id: string;
  name: string;
  kind: 'import' | 'export' | 'function' | 'ipc_channel' | 'syscall' | 'global';
  addressOrOffset: string;
  moduleOrSection: string;
  signature: string;
  xrefCount: number;
}

export interface ExtractedString {
  id: string;
  value: string;
  offset: number;
  length: number;
  encoding: 'ascii' | 'utf-8' | 'utf-16le';
  category: 'ipc_channel' | 'url_endpoint' | 'crypto_constant' | 'symbol_identifier' | 'error_diagnostic' | 'general';
  referencingSymbols: string[];
}

export interface CodeSlice {
  id: string;
  title: string;
  language: 'javascript' | 'wat' | 'x86_64_asm' | 'pseudocode' | 'json';
  startOffset: number;
  endOffset: number;
  content: string;
  relatedSymbols: string[];
}

export interface ArtifactTarget {
  id: string;
  name: string;
  size: number;
  format: ArtifactFormat;
  formatLabel: string;
  architecture: string;
  sha256: string;
  entropy: number;
  magicBytesHex: string;
  stagedPath?: string;
  sections: BinarySection[];
  symbols: ArtifactSymbol[];
  strings: ExtractedString[];
  codeSlices: CodeSlice[];
  hexBytes: number[]; // First 2048 bytes for rapid synchronized hex inspection
  presetPrompts: string[];
}

export type McpSchemaProfile = 'compact' | 'full';

export interface McpToolDefinition {
  name: string;
  cliCommand?: string;
  category: 'artifact_inventory' | 'javascript_electron' | 'native_binary' | 'wasm_managed' | 'reconstruction_ledger' | 'evidence_unknowns';
  summary: string;
  compactSchema: Record<string, unknown>;
  fullSchema: Record<string, unknown>;
  defaultArgs: Record<string, unknown>;
  outputContract: string;
}

export interface CanonicalReaEvidence {
  evidence_id: string;
  tool_name: string;
  timestamp: string;
  analysis_profile: {
    provider_id: string;
    schema_profile: McpSchemaProfile;
    deterministic: boolean;
  };
  coverage: {
    scope: 'root' | 'container-entries' | 'procedure-local' | 'application-graph';
    status: 'complete' | 'partial' | 'unknown';
  };
  facet_availability?: Record<
    string,
    { available: boolean; reason?: string }
  >;
  normalized_result: Record<string, unknown>;
  raw_result: Record<string, unknown> | null;
  limitations: string[];
}

export interface McpTraceEntry {
  id: string;
  timestamp: string;
  toolName: string;
  durationMs: number;
  schemaProfile: McpSchemaProfile;
  requestJsonRpc: {
    jsonrpc: '2.0';
    id: number;
    method: 'tools/call';
    params: {
      name: string;
      arguments: Record<string, unknown>;
    };
  };
  responseJsonRpc: {
    jsonrpc: '2.0';
    id: number;
    result: {
      resultType: 'complete';
      isError: boolean;
      structuredContent: CanonicalReaEvidence;
    };
  };
}

export interface ClonedRepoInfo {
  cloned: boolean;
  packageName: string;
  mcpName: string;
  version: string;
  description: string;
  repositoryUrl: string;
  license: string;
  nodeEngines: string;
  totalCliCommands: number;
  totalMcpToolsWithoutCli: number;
  cliCommandsSample: string[];
  mcpOnlyToolsSample: string[];
  topLevelEntries: { name: string; type: 'file' | 'directory'; size?: number }[];
  inspectableFiles: string[];
}

export interface EvidenceItem {
  id: string;
  evidenceIdRef: string;
  title: string;
  claim: string;
  mcpToolUsed: string;
  offsetOrSymbol: string;
  confidence: 'Verified' | 'High' | 'Corroborated';
  codeOrHexSnippet: string;
  facetObserved: string;
}

export interface LogicGraphNode {
  id: string;
  label: string;
  role: 'entry' | 'ipc_bridge' | 'codec_crypto' | 'validator' | 'sink';
  symbolOrOffset: string;
  description: string;
  evidenceIds: string[];
  inputs: string[];
  outputs: string[];
}

export interface LogicGraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  protocolOrData: string;
  verified: boolean;
}

export interface UnknownOrLimitation {
  id: string;
  kind: 'limitation' | 'unknown';
  scope: string;
  description: string;
  recommendedProbe: string;
  status: 'open' | 'mitigated';
}

export interface InvestigationResult {
  id: string;
  targetName: string;
  objective: string;
  timestamp: string;
  summary: string;
  hypothesisStatus: 'Verified by Static Evidence' | 'Partially Verified (Runtime Unknowns Remain)';
  mcpToolCalls: McpTraceEntry[];
  evidence: EvidenceItem[];
  logicGraph: {
    nodes: LogicGraphNode[];
    edges: LogicGraphEdge[];
  };
  limitationsAndUnknowns: UnknownOrLimitation[];
}

export interface ReconstructionObligation {
  id: string;
  dimension: 'signature_shape' | 'frame_layout' | 'state_transition' | 'error_contract' | 'invariants';
  obligation: string;
  supportingEvidenceId: string;
  status: 'satisfied' | 'bounded_assumption';
  verificationNote: string;
}

export interface CleanroomOutput {
  id: string;
  targetName: string;
  generatedAt: string;
  specTitle: string;
  protocolOverview: string;
  coverageScore: {
    satisfiedObligations: number;
    totalObligations: number;
    coverageStatus: 'Complete Root & Export Coverage' | 'Partial (Runtime Constants Parameterized)';
  };
  obligationsLedger: ReconstructionObligation[];
  dataStructures: {
    name: string;
    purpose: string;
    fields: { name: string; type: string; offsetOrConstraint: string }[];
  }[];
  behavioralContract: {
    step: string;
    precondition: string;
    operation: string;
    postcondition: string;
  }[];
  interoperableCode: string;
  verificationChecklist: string[];
}
