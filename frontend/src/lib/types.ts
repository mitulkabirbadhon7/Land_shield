/**
 * LandShield TypeScript Type Definitions
 * Corresponds to FastAPI schemas and TRD specifications
 */

export type DeedStatus = "VALID" | "TAMPERED" | "SUPERSEDED" | "CANCELLED" | "UNKNOWN";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FindingSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type UserRole = "registrar" | "officer" | "admin";

export interface VerifyOut {
  deed_no: string;
  status: DeedStatus;
  reasons: string[];
  deed_hash?: string | null;
  key_id?: string | null;
  chain_seq?: number | null;
  chain_position?: number | null;
  chain_ok?: boolean;
  registered_at?: string | null;
  seller_masked?: string | null;
  buyer_masked?: string | null;
  plot_id?: number | null;
  area_sold?: number | null;
}

export interface PlotOut {
  id: number;
  dag_no: string;
  mouza: string;
  upazila: string;
  district: string;
  area_decimal: number;
  remaining_decimal?: number;
  sold_decimal?: number;
  land_type: string;
  is_khas?: boolean;
  is_acquisition?: boolean;
  is_disputed?: boolean;
  initial_owner_masked?: string;
  current_owner_masked?: string;
  initial_owner_id?: number | null;
  current_owner_id?: number | null;
  initial_owner_name?: string | null;
  current_owner_name?: string | null;
  flags?: string[];
}

export interface ChainItem {
  seq?: number;
  deed_no: string;
  deed_hash?: string;
  entry_hash?: string;
  timestamp?: string;
  date?: string;
  buyer_masked?: string;
  buyer?: string;
  deed_status?: string;
  verify_status?: DeedStatus | string;
  area_sold?: number;
}

export interface RiskFinding {
  rule_id: string;
  sub_code: string;
  layer: string;
  severity: FindingSeverity;
  weight: number;
  decisive: boolean;
  deed_no?: string | null;
  text: string;
}

export interface MutationSummary {
  total?: number;
  completed?: number;
  pending?: number;
  rejected?: number;
  total_deeds?: number;
  mutated_deeds?: number;
  pending_mutations?: number;
  missing_mutations?: number;
  latest_mutation_state?: string | null;
}


export interface RiskReportOut {
  mode: "PLOT";
  plot_id: number;
  score: number;
  level: RiskLevel;
  has_critical: boolean;
  findings: RiskFinding[];
  chain_ok: boolean;
  flags: {
    is_khas: boolean;
    is_acquisition: boolean;
    is_disputed: boolean;
    active_cases_count: number;
  } | string[];
  mutation_summary: MutationSummary;
  layers?: Record<string, RiskFinding[]>;
  layers_run?: string[];
  lineage_available?: boolean | null;
}

export interface KhatianNode {
  id: number;
  plot_id: number;
  survey_type: "CS" | "SA" | "RS" | "BS" | string;
  khatian_no: string;
  dag_no: string;
  area_decimal: number;
  owners?: string[] | { name?: string; share?: number }[] | string;
  parent_id?: number | null;
}

export interface LineageIssue {
  code: "MISSING_GENERATION" | "ORPHAN" | "BAD_PARENT" | "AREA_GROWTH" | string;
  message: string;
  survey_type?: string;
  khatian_no?: string;
}

export interface LineageOut {
  plot_id: number;
  nodes: KhatianNode[];
  edges?: { from: number; to: number }[];
  issues: LineageIssue[] | string[];
  lineage_available: boolean;
}

export interface ReconcileIssue {
  code: "OWNER_MISMATCH" | "MUTATION_STALLED" | "AREA_NOT_CONSERVED" | string;
  message: string;
  detail?: string;
  sub_code?: string;
  plot_id?: number;
}

export interface ReconcilePlotItem {
  plot_id: number;
  dag_no: string;
  mouza: string;
  upazila: string;
  district: string;
  issues: ReconcileIssue[];
}

export interface ReconcileListOut {
  items: ReconcilePlotItem[];
  total: number;
  page: number;
  size: number;
}


export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  name: string;
}

export interface ApiError {
  code: string;
  detail?: string;
  report?: unknown;
  status?: number;
}

export interface PersonOut {
  id: number;
  display_name: string;
  masked_nid_hash?: string | null;
  is_synthetic: boolean;
}

export interface SubRegistry {
  code: string;
  name: string;
}

export interface MetaOut {
  deed_types: string[];
  sub_registries: SubRegistry[];
}

export interface DeedCreate {
  plot_id: number;
  seller_id: number;
  buyer_id: number;
  area_sold: number;
  deed_type?: string;
  sub_registry?: string;
}

export interface DeedOut {
  id: number;
  deed_no: string;
  plot_id: number;
  seller_id: number;
  buyer_id: number;
  seller_name?: string | null;
  buyer_name?: string | null;
  area_sold: number;
  deed_type: string;
  sub_registry: string;
  registered_at: string;
  deed_hash: string;
  signer_key_id?: string | null;
  status: string;
}

export interface DeedRegistrationResponse {
  deed: DeedOut;
  verify: VerifyOut;
}

export interface MutationCreate {
  deed_id: number;
  applicant_id?: number | null;
  auto_check?: boolean;
}

export interface MutationEventOut {
  id: number;
  from_state: string;
  to_state: string;
  actor_id?: number | null;
  note?: string | null;
  at: string;
}

export interface MutationTransition {
  to_state: string;
  note?: string | null;
}

export interface MutationOut {
  id: number;
  deed_id: number;
  deed_no?: string | null;
  plot_id: number;
  state: string;
  applicant_id: number;
  applicant_name?: string | null;
  officer_id?: number | null;
  requires_override: boolean;
  created_at: string;
  updated_at: string;
  events?: MutationEventOut[];
  auto_check_json?: {
    blocked?: boolean;
    score?: number;
    level?: string;
    findings?: FraudFinding[];
    has_critical?: boolean;
  } | null;
}

export interface AlertOut {
  id: number;
  deed_id?: number | null;
  plot_id: number;
  rule_id: string;
  severity: string;
  reasons: string[];
  status: string;
  created_at: string;
}

export interface AuditLogOut {
  id: number;
  actor_id?: number | null;
  action: string;
  entity: string;
  entity_id?: number | null;
  at: string;
  detail?: string | null;
}

export interface DevStatusOut {
  demo_mode: boolean;
}

export interface TamperResult {
  status: string;
  deed_no: string;
  original_area?: number;
  tampered_area?: number;
  area_sold?: number;
}

export interface FraudFinding {
  rule_id: string;
  sub_code?: string;
  layer?: string;
  severity: string;
  weight?: number;
  decisive?: boolean;
  deed_no?: string | null;
  reasons?: string[];
  title?: string;
  text?: string;
}

export interface FraudReport {
  blocked: boolean;
  score: number;
  level: string;
  has_critical: boolean;
  findings: FraudFinding[];
}

export interface ReportLayerBreakdown {
  layer: string;
  title: string;
  status: "PASS" | "WARN" | "FAIL";
  findings: string[];
}

export interface DueDiligenceReportOut {
  plot_id: number;
  report_id: string;
  generated_at: string;
  lang: "bn" | "en";
  plot_summary: {
    dag_no: string;
    mouza: string;
    upazila: string;
    district: string;
    area_decimal: number;
    current_owner?: string;
  };
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  risk_score: number;
  executive_summary: string;
  layer_breakdown: ReportLayerBreakdown[];
  actionable_checklist: string[];
  legal_disclaimer: string;
}



