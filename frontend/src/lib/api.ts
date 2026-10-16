import {
  AlertOut,
  ApiError as IApiError,
  AuditLogOut,
  ChainItem,
  DeedCreate,
  DeedRegistrationResponse,
  DevStatusOut,
  LoginResponse,
  MetaOut,
  MutationCreate,
  MutationOut,
  MutationTransition,
  PersonOut,
  PlotOut,
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
    cache: "no-store",
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


