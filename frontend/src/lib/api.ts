import {
  ApiError as IApiError,
  ChainItem,
  LoginResponse,
  PlotOut,
  RiskReportOut,
  UserRole,
  VerifyOut,
} from "./types";

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
