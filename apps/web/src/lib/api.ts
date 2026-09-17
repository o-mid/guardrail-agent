const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type Tokens = { accessToken: string; refreshToken: string };

export type AuditEvent = {
  _id: string;
  type: string;
  entityId: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type PlanIntent = {
  _id: string;
  text?: string;
  status: string;
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
