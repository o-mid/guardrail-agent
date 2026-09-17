const DEAD_HOSTED_API = "https://api-production-3231.up.railway.app";
const LIVE_HOSTED_API = "https://api-production-c5d48.up.railway.app";
const configured = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const API_URL = configured === DEAD_HOSTED_API ? LIVE_HOSTED_API : configured;

export type Tokens = { accessToken: string; refreshToken: string };

export type AuditEvent = {
  _id: string;
  type: string;
  entityId: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type PlannerUsage = {
  promptTokens: number;
  completionTokens: number;
};

export type PlanIntent = {
  _id: string;
  text?: string;
  status: string;
  plannerLatencyMs?: number | null;
  plannerModel?: string | null;
  usage?: PlannerUsage | null;
};

function authHeader(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
      ...headers,
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    detail?: string;
  };
  if (!res.ok) {
    const base = data.error ?? `request_failed_${res.status}`;
    throw new Error(data.detail ? `${base}: ${data.detail}` : base);
  }
  return data as T;
}

export { API_URL };
