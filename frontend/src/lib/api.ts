import {
  AlertOut,
  ApiError as IApiError,
  AuditLogOut,
  ChainItem,
  DeedCreate,
  DeedRegistrationResponse,
  DevStatusOut,
  DueDiligenceReportOut,
  LoginResponse,
  LineageOut,
  MetaOut,
  MutationCreate,
  MutationOut,
  MutationTransition,
  PersonOut,
  PlotOut,
  ReconcileIssue,
  ReconcileListOut,
  ReportLayerBreakdown,
  RiskReportOut,
  TamperResult,
  UserRole,
  VerifyOut,
} from "./types";

if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_API_URL &&
  process.env.CI !== "true"
) {
  throw new Error("NEXT_PUBLIC_API_URL is required for production builds");
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8000/api/v1";

const TOKEN_KEY = "landshield_token";
const USER_KEY = "landshield_user";

export class ApiError extends Error implements IApiError {
  code: string;
  detail?: string;
  report?: unknown;
  status: number;

  constructor(status: number, code: string, detail?: string, report?: unknown) {
    super(detail || code || `API error with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.report = report;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage quota or access issues
  }
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

export interface StoredUser {
  role: UserRole;
  name: string;
}

export function getCurrentUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: StoredUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore
  }
}

export function logout(): void {
  removeToken();
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // Ignore
    }
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { requiresAuth = false, headers = {}, ...rest } = options;
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  const reqHeaders = new Headers(headers);
  if (!reqHeaders.has("Content-Type") && !(rest.body instanceof FormData)) {
    reqHeaders.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) {
    reqHeaders.set("Authorization", `Bearer ${token}`);
  } else if (requiresAuth) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
  });

  if (!res.ok) {
    let errBody: { code?: string; detail?: unknown; report?: unknown } = {};
    try {
      errBody = await res.json();
    } catch {
      // Body was not JSON
    }

    const code = errBody.code || `HTTP_${res.status}`;
    let detail: string | undefined;
    if (typeof errBody.detail === "string") {
      detail = errBody.detail;
    } else if (Array.isArray(errBody.detail) && errBody.detail.length > 0) {
      const first = errBody.detail[0] as { msg?: string } | undefined;
      detail = first?.msg || "Validation error";
    }

    throw new ApiError(res.status, code, detail, errBody.report);
  }

  // Handle empty or 204 responses
  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

// -------------------------------------------------------------
// Typed API Methods
// -------------------------------------------------------------

export async function login(username: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
  setCurrentUser({ role: data.role, name: data.name });
  return data;
}

export async function verifyDeed(deedNo: string): Promise<VerifyOut> {
  return apiFetch<VerifyOut>(`/deeds/${encodeURIComponent(deedNo)}/verify`);
}

export async function getPlot(plotId: number): Promise<PlotOut> {
  return apiFetch<PlotOut>(`/plots/${plotId}`);
}

export async function getChain(plotId: number): Promise<ChainItem[]> {
  return apiFetch<ChainItem[]>(`/plots/${plotId}/chain`);
}

export async function getRisk(
  plotId: number,
  lang: "bn" | "en" = "bn"
): Promise<RiskReportOut> {
  return apiFetch<RiskReportOut>(`/risk/plot/${plotId}?lang=${lang}`);
}

export async function getAnalysis(
  plotId: number,
  lang: "bn" | "en" = "bn"
): Promise<RiskReportOut> {
  try {
    return await apiFetch<RiskReportOut>(`/analysis/plot/${plotId}?lang=${lang}`);
  } catch {
    // Graceful fallback to /risk/plot
    return await apiFetch<RiskReportOut>(`/risk/plot/${plotId}?lang=${lang}`);
  }
}

export async function getLineage(plotId: number): Promise<LineageOut | null> {
  try {
    return await apiFetch<LineageOut>(`/lineage/${plotId}`);
  } catch {
    return null;
  }
}

export async function listReconcile(params?: {
  district?: string;
  type?: string;
  page?: number;
  size?: number;
}): Promise<ReconcileListOut> {
  const q = new URLSearchParams();
  if (params?.district) q.set("district", params.district);
  if (params?.type && params.type !== "ALL") q.set("type", params.type);
  if (params?.page) q.set("page", String(params.page));
  if (params?.size) q.set("size", String(params.size));
  const qs = q.toString();
  return apiFetch<ReconcileListOut>(`/reconcile${qs ? `?${qs}` : ""}`, {
    requiresAuth: true,
  });
}

export async function getReconcilePlot(
  plotId: number
): Promise<{ plot_id: number; issues: ReconcileIssue[] } | null> {
  try {
    return await apiFetch<{ plot_id: number; issues: ReconcileIssue[] }>(
      `/reconcile/${plotId}`,
      { requiresAuth: true }
    );
  } catch {
    return null;
  }
}

export async function getDueDiligenceReport(
  plotId: number,
  lang: "bn" | "en" = "bn"
): Promise<DueDiligenceReportOut> {
  try {
    return await apiFetch<DueDiligenceReportOut>(
      `/analysis/plot/${plotId}/report?lang=${lang}`
    );
  } catch {
    // Graceful client fallback using getAnalysis + getPlot
    const analysis = await getAnalysis(plotId, lang);
    const plot = await getPlot(plotId);

    const reportId = `LS-REP-2026-${String(plotId).padStart(4, "0")}`;
    const generatedAt = new Date().toISOString();

    const layers: ReportLayerBreakdown[] = [
      {
        layer: "INTEGRITY",
        title:
          lang === "bn"
            ? "ক্রিপ্টোগ্রাফিক সুরক্ষা ও ডিজিটাল স্বাক্ষর"
            : "Cryptographic Integrity & Digital Signatures",
        status: (analysis.findings || []).some(
          (f) => f.layer === "INTEGRITY" && f.severity === "CRITICAL"
        )
          ? "FAIL"
          : "PASS",
        findings: (analysis.findings || [])
          .filter((f) => f.layer === "INTEGRITY")
          .map((f) => f.text || f.rule_id),
      },
      {
        layer: "RULES",
        title:
          lang === "bn"
            ? "বিধিবদ্ধ ভূমি আইন ও হস্তান্তর ধারাবাহিকতা (R1-R6)"
            : "Statutory Rules & Ownership Continuity (R1-R6)",
        status: (analysis.findings || []).some(
          (f) =>
            f.layer === "RULES" &&
            (f.severity === "CRITICAL" || f.severity === "HIGH")
        )
          ? "FAIL"
          : (analysis.findings || []).some((f) => f.layer === "RULES")
          ? "WARN"
          : "PASS",
        findings: (analysis.findings || [])
          .filter((f) => f.layer === "RULES")
          .map((f) => f.text || f.rule_id),
      },
      {
        layer: "RECONCILE",
        title:
          lang === "bn"
            ? "সাব-রেজিস্ট্রি ও এসি ল্যান্ড অফিস ডাটা সমন্বয় (R8)"
            : "Inter-Office Data Reconciliation (R8)",
        status: (analysis.findings || []).some((f) => f.layer === "RECONCILE")
          ? "WARN"
          : "PASS",
        findings: (analysis.findings || [])
          .filter((f) => f.layer === "RECONCILE")
          .map((f) => f.text || f.rule_id),
      },
      {
        layer: "LINEAGE",
        title:
          lang === "bn"
            ? "সিএস থেকে বিএস জরিপ খতিয়ান ধারাবাহিকতা (R7)"
            : "CS to BS Survey Lineage Continuity (R7)",
        status: (analysis.findings || []).some((f) => f.layer === "LINEAGE")
          ? "WARN"
          : "PASS",
        findings: (analysis.findings || [])
          .filter((f) => f.layer === "LINEAGE")
          .map((f) => f.text || f.rule_id),
      },
    ];

    let executiveSummary = "";
    const checklist: string[] = [];

    if (analysis.score >= 60 || analysis.level === "HIGH") {
      executiveSummary =
        lang === "bn"
          ? `উচ্চ ঝুঁকির জমি! দাগ নং ${plot.dag_no}-এ এক বা একাধিক গুরুতর জালিয়াতি বা মালিকানা অসঙ্গতির ঝুঁকি ধরা পড়েছে। লেনদেন বা বায়না করার আগে পূর্ণাঙ্গ যাচাই কাম্য।`
          : `High Risk Plot! Significant ownership discrepancies or fraud risks detected on Plot #${plot.dag_no}. Transactions should be halted until formal verification.`;
      checklist.push(
        lang === "bn"
          ? "কোনোরূপ বায়না বা অগ্রিম টাকা প্রদান করবেন না।"
          : "Do not make any advance or token money payments.",
        lang === "bn"
          ? "উপজেলা সাব-রেজিস্ট্রি অফিসে মূল বালাম বহির ভলিউম ও খণ্ড মেলান।"
          : "Inspect original Balam volume at Sub-Registry Office.",
        lang === "bn"
          ? "সহকারী কমিশনার (ভূমি) অফিসে গিয়ে নামজারি মিসকেস বা রেকর্ড যাচাই করুন।"
          : "Visit AC Land office to verify mutation records and misc cases.",
        lang === "bn"
          ? "সরজমিনে গিয়ে দখলদার ব্যক্তি ও সীমানা চিহ্নিত করুন।"
          : "Physically inspect ground possession and boundaries."
      );
    } else if (analysis.score >= 25 || analysis.level === "MEDIUM") {
      executiveSummary =
        lang === "bn"
          ? `মাঝারি ঝুঁকির জমি। দাগ নং ${plot.dag_no}-এ কিছু নামজারি বা কাগজপত্রের অসম্পূর্ণতা রয়েছে, যা কেনার পূর্বে সমাধান করা প্রয়োজন।`
          : `Medium Risk Plot. Plot #${plot.dag_no} has pending mutations or paperwork gaps requiring resolution before purchase.`;
      checklist.push(
        lang === "bn"
          ? "সর্বশেষ নামজারি পর্চা ও ডিসিআর (DCR) চেক করুন।"
          : "Inspect latest mutation khatian and DCR.",
        lang === "bn"
          ? "ভূমি উন্নয়ন কর (খাজনা) হালনাগাদ দাখিলা রয়েছে কিনা দেখুন।"
          : "Verify up-to-date land development tax receipts (Dakhila).",
        lang === "bn"
          ? "সরজমিনে দখল ও এলাকার গণ্যমান্যদের থেকে সত্যতা নিশ্চিত হন।"
          : "Confirm physical possession with local community."
      );
    } else {
      executiveSummary =
        lang === "bn"
          ? `বিশুদ্ধ রেকর্ড! দাগ নং ${plot.dag_no}-এর স্বত্ব ধারাবাহিকতা, ডিজিটাল স্বাক্ষর ও হস্তান্তর ইতিহাস সম্পূর্ণ অবিকৃত ও সন্তোষজনক পাওয়া গেছে।`
          : `Clean Title! Plot #${plot.dag_no} demonstrates unbroken ownership chain, valid cryptographic signatures, and clear title.`;
      checklist.push(
        lang === "bn"
          ? "রেজিস্ট্রেশন ফি ও স্ট্যাম্প শুল্ক নির্ধারিত ব্যাংকে জমা দিন।"
          : "Deposit standard registration stamp fees in authorized bank.",
        lang === "bn"
          ? "সাব-রেজিস্ট্রি অফিসে মূল দলিলের মাধ্যমে রেজিস্ট্রেশন সম্পন্ন করুন।"
          : "Execute official deed registration at Sub-Registry office.",
        lang === "bn"
          ? "রেজিস্ট্রেশনের পর তাৎক্ষণিকভাবে ই-নামজারি আবেদন দাখিল করুন।"
          : "Submit e-mutation application immediately after registration."
      );
    }

    return {
      plot_id: plotId,
      report_id: reportId,
      generated_at: generatedAt,
      lang: lang,
      plot_summary: {
        dag_no: plot.dag_no,
        mouza: plot.mouza,
        upazila: plot.upazila,
        district: plot.district,
        area_decimal: plot.area_decimal,
        current_owner: plot.current_owner_name || plot.current_owner_masked || undefined,
      },
      risk_level: (analysis.level as "LOW" | "MEDIUM" | "HIGH") || "LOW",
      risk_score: analysis.score || 0,
      executive_summary: executiveSummary,
      layer_breakdown: layers,
      actionable_checklist: checklist,
      legal_disclaimer:
        lang === "bn"
          ? "এই রিপোর্টটি ভূমি-সুরক্ষা (LandShield) প্ল্যাটফর্মের স্বয়ংক্রিয় ক্রিপ্টোগ্রাফিক ও ফ্রড ইঞ্জিন দ্বারা প্রস্তুতকৃত একটি নাগরিক সচেতনতা পরামর্শ মাত্র। এটি দেওয়ানি আদালত বা আইনগত স্বত্বের চূড়ান্ত বিকল্প নয়।"
          : "This due-diligence report is an automated advisory generated by LandShield's cryptographic and fraud detection engine. It serves as public guidance and does not supersede statutory court decrees or official land records.",
    };
  }
}



export async function searchPlots(
  mouza?: string,
  dagNo?: string
): Promise<PlotOut[]> {
  const params = new URLSearchParams();
  if (mouza) params.set("mouza", mouza);
  if (dagNo) params.set("dag_no", dagNo);
  const query = params.toString();
  return apiFetch<PlotOut[]>(`/plots/search${query ? `?${query}` : ""}`);
}

export async function searchPersons(
  q?: string,
  limit: number = 20
): Promise<PersonOut[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return apiFetch<PersonOut[]>(`/persons/search${query ? `?${query}` : ""}`, {
    requiresAuth: true,
  });
}

export async function getMeta(): Promise<MetaOut> {
  return apiFetch<MetaOut>("/meta", {
    requiresAuth: true,
  });
}

export async function createDeed(
  payload: DeedCreate
): Promise<DeedRegistrationResponse> {
  return apiFetch<DeedRegistrationResponse>("/deeds", {
    method: "POST",
    body: JSON.stringify(payload),
    requiresAuth: true,
  });
}

export async function getDeedQrBlob(deedNo: string): Promise<Blob> {
  const token = getToken();
  const url = `${API_BASE}/deeds/${encodeURIComponent(deedNo)}/qr`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let errCode = `HTTP_${res.status}`;
    let errDetail = "Failed to load QR image";
    try {
      const errJson = await res.json();
      if (errJson.code) errCode = errJson.code;
      if (errJson.detail) errDetail = errJson.detail;
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, errCode, errDetail);
  }
  return res.blob();
}

export async function startMutation(
  payload: MutationCreate
): Promise<MutationOut> {
  return apiFetch<MutationOut>("/mutations", {
    method: "POST",
    body: JSON.stringify(payload),
    requiresAuth: true,
  });
}

export async function listMutations(state?: string): Promise<MutationOut[]> {
  const params = new URLSearchParams();
  if (state && state !== "ALL") params.set("state", state);
  const q = params.toString();
  return apiFetch<MutationOut[]>(`/mutations${q ? `?${q}` : ""}`, {
    requiresAuth: true,
  });
}

export async function getMutation(id: number): Promise<MutationOut> {
  return apiFetch<MutationOut>(`/mutations/${id}`, {
    requiresAuth: true,
  });
}

export async function transitionMutation(
  id: number,
  payload: MutationTransition
): Promise<MutationOut> {
  return apiFetch<MutationOut>(`/mutations/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(payload),
    requiresAuth: true,
  });
}

export async function getAlerts(
  status?: string,
  severity?: string
): Promise<AlertOut[]> {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.set("status", status);
  if (severity && severity !== "ALL") params.set("severity", severity);
  const q = params.toString();
  return apiFetch<AlertOut[]>(`/alerts${q ? `?${q}` : ""}`, {
    requiresAuth: true,
  });
}

export async function updateAlertStatus(
  alertId: number,
  status: string
): Promise<AlertOut> {
  return apiFetch<AlertOut>(`/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    requiresAuth: true,
  });
}

export async function getDevStatus(): Promise<DevStatusOut> {
  return apiFetch<DevStatusOut>("/dev/status", {
    requiresAuth: true,
  });
}

export async function tamperDeed(deedNo: string): Promise<TamperResult> {
  return apiFetch<TamperResult>(`/dev/tamper/${encodeURIComponent(deedNo)}`, {
    method: "POST",
    requiresAuth: true,
  });
}

export async function restoreDeed(deedNo: string): Promise<TamperResult> {
  return apiFetch<TamperResult>(`/dev/restore/${encodeURIComponent(deedNo)}`, {
    method: "POST",
    requiresAuth: true,
  });
}

export async function getAuditLogs(
  page: number = 1,
  size: number = 20
): Promise<AuditLogOut[]> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  return apiFetch<AuditLogOut[]>(`/audit?${params.toString()}`, {
    requiresAuth: true,
  });
}


