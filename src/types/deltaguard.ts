export interface ScenarioConfig {
  id: string;
  index: number;
  name: string;
  category: string;
  ambient_temp_c: number;
  initial_temp_c: number;
  initial_soc: number;
  initial_voltage_v: number;
  requested_current_a: number;
  temp_sensor_fail_at_s: number;
  duration_s: number;
  description: string;
}

export interface TelemetrySummary {
  max_current_a: number;
  max_c_rate: number;
  max_temp_c: number;
  max_voltage_v: number;
  final_soc_pct: number;
  charge_time_s: number;
  contactor_opened: boolean;
  contactor_opened_at_s: number | null;
  fault_reaction_ticks: number | null;
  max_plating_risk_pct: number;
}

export interface TelemetryArrays {
  t: number[];
  voltage_v: number[];
  current_a: number[];
  c_rate: number[];
  temp_c: number[];
  soc_pct: number[];
  dv_dt_mv_s: number[];
  di_dt_a_s: number[];
  contactor_state: number[];
  plating_risk_pct: number[];
}

export interface FirmwareRunResult {
  summary: TelemetrySummary;
  telemetry: TelemetryArrays;
}

export interface GateViolation {
  rule_id: string;
  severity: string;
  message: string;
  asm_root_cause: string;
}

export interface HomologationGateResult {
  naive_test_verdict: string;
  deltaguard_verdict: string;
  is_deceptive_regression: boolean;
  charge_time_delta_pct: number;
  violations: GateViolation[];
}

export interface ScenarioComparisonEntry {
  scenario: ScenarioConfig;
  v1_baseline: FirmwareRunResult;
  v2_candidate: FirmwareRunResult;
  homologation_gate: HomologationGateResult;
}

export interface DiffOutputData {
  generated_at: string;
  execution_time_ms: number;
  cell_model: string;
  baseline_binary: {
    name: string;
    sha256: string;
    size_bytes: number;
  };
  candidate_binary: {
    name: string;
    sha256: string;
    size_bytes: number;
  };
  overall_release_verdict: string;
  failed_scenarios_count: number;
  total_scenarios_count: number;
  deceptive_scenarios_count: number;
  total_violations_count: number;
  scenarios: ScenarioComparisonEntry[];
}

export interface RodataFloatEntry {
  value: number;
  ieee754_hex: string;
  little_endian_bytes: string;
  file_offset: string;
  description: string;
}

export interface ReaBinaryFinding {
  id: string;
  title: string;
  severity: string;
  standard_violated: string;
  v1_behavior: string;
  v2_behavior: string;
  binary_evidence: string;
  correlated_scenario: string;
}

export interface ReaBinaryAnalysis {
  generated_at: string;
  mcp_provider: string;
  binaries: {
    v1_so: string;
    v2_so: string;
    v1_sha256: string;
    v2_sha256: string;
    v1_size: number;
    v2_size: number;
  };
  v1_bms_step_asm: string;
  v2_bms_step_asm: string;
  v1_helper_asm: string;
  v2_helper_asm: string;
  v1_rodata_dump: string;
  v2_rodata_dump: string;
  v1_rodata_floats: RodataFloatEntry[];
  v2_rodata_floats: RodataFloatEntry[];
  v1_symbols: string;
  v2_symbols: string;
  v1_sections: string;
  rea_findings: ReaBinaryFinding[];
}

export interface HomologationRule {
  rule_id: string;
  standard: string;
  severity: string;
  parameter: string;
  max_allowed_value: string;
  rationale: string;
  deceptive_symptom: string;
}

export interface HomologationRulebook {
  cell_specification: {
    manufacturer: string;
    model: string;
    chemistry: string;
    nominal_voltage_v: number;
    min_rated_capacity_ah: number;
    standard_charge_current_a: number;
    standard_charge_c_rate: number;
    jeita_cold_charge_current_a: number;
    jeita_cold_charge_c_rate: number;
    jeita_cold_temp_window_c: [number, number];
    hard_thermal_cutoff_c: number;
    cv_cutoff_voltage_v: number;
    internal_resistance_25c_ohm: number;
    internal_resistance_5c_ohm: number;
  };
  rules: HomologationRule[];
}

export interface AuditCorrelation {
  id: string;
  severity: string;
  rule_id: string;
  standard: string;
  scenario_id: string;
  deceptive_metric: string;
  physical_anomaly: string;
  binary_root_cause: string;
  recommended_c_patch: string;
}

export interface HomologationAuditReport {
  generated_at: string;
  verdict: string;
  executive_summary: string;
  audio_briefing_script: string;
  correlations: AuditCorrelation[];
}

export interface Agent37SandboxReceipt {
  sandbox_provider: string;
  workspace_url: string;
  cloud_handshake_verified: boolean;
  isolation_profile: string;
  syscalls_restricted: boolean;
  network_namespace: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  timestamp: string;
}

export interface GithubUpstreamSnippet {
  fetched_live: boolean;
  repository: string;
  source_url: string;
  file_path: string;
  byte_length: number;
  snippet: string;
}

export interface DeltaGuardStatePayload {
  diffOutput: DiffOutputData;
  reaAnalysis: ReaBinaryAnalysis;
  rulebook: HomologationRulebook;
  auditReport: HomologationAuditReport;
  v1SourceC: string;
  v2SourceC: string;
}
