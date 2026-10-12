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
  land_type: string;
  is_khas: boolean;
  is_acquisition: boolean;
  is_disputed: boolean;
  initial_owner_masked: string;
  current_owner_masked: string;
}

export interface ChainItem {
  seq: number;
  deed_no: string;
  deed_hash: string;
  entry_hash: string;
  timestamp: string;
  buyer_masked: string;
  deed_status: string;
  verify_status: DeedStatus;
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
  total: number;
  completed: number;
  pending: number;
  rejected: number;
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
  };
  mutation_summary: MutationSummary;
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

export interface MutationOut {
  id: number;
  deed_id: number;
  plot_id: number;
  state: string;
  applicant_id: number;
  applicant_name?: string | null;
  officer_id?: number | null;
  requires_override: boolean;
  created_at: string;
  updated_at: string;
  events?: unknown[];
  auto_check_json?: Record<string, unknown> | null;
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

