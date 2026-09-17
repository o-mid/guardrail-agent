import { Plan, PlanStep } from "../models/index.js";
import { recordPlanEvent } from "../observability/planLog.js";
import type { PlannerUsage } from "../planner/types.js";
import { validatePlan } from "../policy/client.js";
import { publishPlanEvent } from "../sse/hub.js";
import { loadPolicy } from "./intentPipeline.js";

export type ExecResult = { ok: boolean; txHash?: string; error?: string; dryRunOk?: boolean };

export type StoredPlanForPolicy = {
  userId: string;
  schemaVersion: string;
  chain: string;
  summary: string;
  steps: Array<{ index: number; payload: unknown }>;
};

// filled in by chain executors in later commits
let stepExecutor: ((planId: string, stepIndex: number) => Promise<ExecResult>) | null = null;

export function installStepExecutor(fn: (planId: string, stepIndex: number) => Promise<ExecResult>): void {
  stepExecutor = fn;
}

export function storedPlanJson(
  plan: { schemaVersion: string; chain: string; summary: string },
  steps: Array<{ index: number; payload: unknown }>,
) {
  return {
    schemaVersion: plan.schemaVersion,
    chain: plan.chain,
    summary: plan.summary,
    steps: [...steps].sort((a, b) => a.index - b.index).map((s) => s.payload),
  };
}

export async function recheckPlanPolicy(
  userId: string,
  plan: { schemaVersion: string; chain: string; summary: string },
  steps: Array<{ index: number; payload: unknown }>,
) {
  const policy = await loadPolicy(userId);
  return validatePlan(storedPlanJson(plan, steps), { version: policy.version, rules: policy.rules });
}

function tokensOf(usage: { promptTokens?: number; completionTokens?: number } | null | undefined): PlannerUsage | null {
  if (!usage || typeof usage.promptTokens !== "number" || typeof usage.completionTokens !== "number") return null;
  return { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens };
}

function planLogFields(plan: {
  id?: string;
  _id?: unknown;
  intentId?: unknown;
  plannerLatencyMs?: number | null;
  usage?: { promptTokens?: number; completionTokens?: number } | null;
}) {
  const planId = plan.id ?? (plan._id != null ? String(plan._id) : null);
  return {
    intentId: plan.intentId != null ? String(plan.intentId) : null,
    planId,
    latencyMs: plan.plannerLatencyMs ?? null,
    tokens: tokensOf(plan.usage),
  };
}

export async function vaultPolicyGate(stored: StoredPlanForPolicy): Promise<ExecResult | null> {
  let validation;
  try {
    validation = await recheckPlanPolicy(stored.userId, stored, stored.steps);
  } catch {
    return { ok: false, error: "policy_unreachable" };
  }
  if (validation.ok) return null;
  const code = validation.policyCodes[0] ?? validation.schemaErrors[0] ?? "denied";
  return { ok: false, error: `policy_rejected:${code}` };
}

export async function approveStep(userId: string, planId: string, index: number) {
  const plan = await Plan.findOne({ _id: planId, userId });
  if (!plan) return { error: "not_found" as const };
  if (["cancelled", "rejected_schema", "rejected_policy", "completed", "failed"].includes(plan.status)) {
    return { error: "plan_not_approvable" as const };
  }

  const steps = await PlanStep.find({ planId }).sort({ index: 1 });
  const existing = steps.find((s) => s.index === index);
  if (!existing) return { error: "not_found" as const };

  if (existing.status === "succeeded") {
    return { plan, step: existing, noop: true as const };
  }
  if (index > 0) {
    const prev = steps.find((s) => s.index === index - 1);
    if (!prev || prev.status !== "succeeded") {
      return { error: "previous_step_incomplete" as const };
    }
  }

  let validation;
  try {
    validation = await recheckPlanPolicy(userId, plan, steps);
  } catch (err) {
    await recordPlanEvent({
      type: "step.policy_unreachable",
      entityId: plan.id,
      userId,
      payload: { index, error: String(err) },
      ...planLogFields(plan),
    });
    publishPlanEvent(userId, plan.id, "step", {
      type: "policy_unreachable",
      index,
      status: plan.status,
    });
    return { error: "policy_unreachable" as const };
  }

  const policyCodes = validation.policyCodes ?? [];
  const schemaErrors = validation.schemaErrors ?? [];
  const humanMessages = validation.humanMessages ?? [];
  if (!validation.ok) {
    await recordPlanEvent({
      type: "step.rejected_policy",
      entityId: plan.id,
      userId,
      payload: { index, policyCodes, schemaErrors, humanMessages },
      policyCodes,
      ...planLogFields(plan),
    });
    publishPlanEvent(userId, plan.id, "step", {
      type: "policy_rejected",
      index,
      policyCodes,
      schemaErrors,
      humanMessages,
      status: plan.status,
    });
    return { error: "rejected_policy" as const, policyCodes, schemaErrors, humanMessages };
  }

  // Atomic claim — blocks double-approve races that reuse the same Anvil nonce.
  const step = await PlanStep.findOneAndUpdate(
    { planId, index, status: { $in: ["pending", "failed"] } },
    { $set: { status: "approved", error: null } },
    { new: true },
  );
  if (!step) {
    return { error: "step_not_pending" as const };
  }

  plan.status = "executing";
  await plan.save();
  await recordPlanEvent({
    type: "step.approved",
    entityId: plan.id,
    userId,
    payload: { index },
    ...planLogFields(plan),
  });
  publishPlanEvent(userId, plan.id, "step", { type: "approved", index, status: plan.status });

  step.status = "dry_running";
  await step.save();

  let result: ExecResult;
  if (stepExecutor) {
    result = await stepExecutor(plan.id, index);
  } else {
    // local stub until chain executors land
    result = { ok: true, dryRunOk: true, txHash: `stub-${plan.id}-${index}` };
  }

  if (!result.ok) {
    step.status = "failed";
    step.dryRunOk = result.dryRunOk ?? false;
    step.error = result.error ?? "execution_failed";
    await step.save();
    plan.status = "failed";
    await plan.save();
    await recordPlanEvent({
      type: "step.failed",
      entityId: plan.id,
      userId,
      payload: { index, error: step.error },
      ...planLogFields(plan),
    });
    publishPlanEvent(userId, plan.id, "step", { type: "failed", index, error: step.error, status: plan.status });
    return { plan, step, result };
  }

  step.status = "submitting";
  step.dryRunOk = true;
  await step.save();
  step.status = "succeeded";
  step.txHash = result.txHash ?? null;
  await step.save();
  await recordPlanEvent({
    type: "step.succeeded",
    entityId: plan.id,
    userId,
    payload: { index, txHash: step.txHash },
    ...planLogFields(plan),
  });
  publishPlanEvent(userId, plan.id, "step", {
    type: "succeeded",
    index,
    txHash: step.txHash,
    status: plan.status,
  });

  const remaining = await PlanStep.countDocuments({ planId, status: { $nin: ["succeeded", "cancelled"] } });
  if (remaining === 0) {
    plan.status = "completed";
    await plan.save();
    await recordPlanEvent({ type: "plan.completed", entityId: plan.id, userId, payload: {}, ...planLogFields(plan) });
    publishPlanEvent(userId, plan.id, "plan", { type: "completed", status: plan.status });
  } else {
    plan.status = "awaiting_approval";
    await plan.save();
    publishPlanEvent(userId, plan.id, "plan", { type: "awaiting_approval", status: plan.status });
  }

  return { plan, step, result };
}

export async function rejectPlan(userId: string, planId: string) {
  const plan = await Plan.findOne({ _id: planId, userId });
  if (!plan) return { error: "not_found" as const };
  if (plan.status === "completed") return { error: "already_completed" as const };

  plan.status = "cancelled";
  await plan.save();
  await PlanStep.updateMany(
    { planId, status: { $in: ["pending", "approved", "dry_running", "submitting"] } },
    { $set: { status: "cancelled" } },
  );
  await recordPlanEvent({
    type: "plan.cancelled",
    entityId: plan.id,
    userId,
    payload: {},
    ...planLogFields(plan),
  });
  publishPlanEvent(userId, plan.id, "plan", { type: "cancelled", status: plan.status });
  return { plan };
}
