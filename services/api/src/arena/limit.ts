import { createHash } from "node:crypto";

const buckets = new Map<string, { resetAt: number; count: number }>();

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}\n${ip}`).digest("hex");
}

export function allowRequest(
  hash: string,
  now: number,
  limit = 10,
  windowMs = 10 * 60 * 1000,
  store: Map<string, { resetAt: number; count: number }> = buckets,
): boolean {
  const current = store.get(hash);
  if (!current || now >= current.resetAt) {
    store.set(hash, { resetAt: now + windowMs, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function resetRateLimits(): void {
  buckets.clear();
}
