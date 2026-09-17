import { AuditEvent } from "../models/index.js";
import type { PlannerUsage } from "../planner/types.js";

export type PlanLifecycleLog = {
  ts: string;
  event: string;
  intentId: string | null;
  planId: string | null;
  policyCodes: string[];
  latencyMs: number | null;
  tokens: PlannerUsage | null;
};

export function writePlanLog(fields: Omit<PlanLifecycleLog, "ts">): PlanLifecycleLog {
  const line: PlanLifecycleLog = {
    ts: new Date().toISOString(),
    event: fields.event,
    intentId: fields.intentId,
    planId: fields.planId,
    policyCodes: fields.policyCodes,
    latencyMs: fields.latencyMs,
    tokens: fields.tokens,
  };
  console.log(JSON.stringify(line));
  return line;
}

export async function recordPlanEvent(input: {
  type: string;
  entityId: string;
  userId: string;
  payload?: Record<string, unknown>;
  intentId?: string | null;
  planId?: string | null;
  policyCodes?: string[];
  latencyMs?: number | null;
  tokens?: PlannerUsage | null;
}) {
  const doc = await AuditEvent.create({
    type: input.type,
    entityId: input.entityId,
    userId: input.userId,
    payload: input.payload ?? {},
  });
  writePlanLog({
    event: input.type,
    intentId: input.intentId ?? null,
    planId: input.planId ?? null,
    policyCodes: input.policyCodes ?? [],
    latencyMs: input.latencyMs ?? null,
    tokens: input.tokens ?? null,
  });
  return doc;
}
