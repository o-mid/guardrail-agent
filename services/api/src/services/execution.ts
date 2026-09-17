import { AuditEvent, Plan, PlanStep } from "../models/index.js";
import { validatePlan } from "../policy/client.js";
import { publishPlanEvent } from "../sse/hub.js";
import { loadPolicy } from "./intentPipeline.js";

export type ExecResult = { ok: boolean; txHash?: string; error?: string; dryRunOk?: boolean };

// filled in by chain executors in later commits
let runner: ((planId: string, stepIndex: number) => Promise<ExecResult>) | null = null;

export function setStepRunner(fn: (planId: string, stepIndex: number) => Promise<ExecResult>): void {
  runner = fn;
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
    await AuditEvent.create({
      type: "step.policy_unreachable",
      entityId: plan.id,
      userId,
      payload: { index, error: String(err) },
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
    await AuditEvent.create({
      type: "step.rejected_policy",
      entityId: plan.id,
      userId,
      payload: { index, policyCodes, schemaErrors, humanMessages },
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
  await AuditEvent.create({
    type: "step.approved",
    entityId: plan.id,
    userId,
    payload: { index },
  });
  publishPlanEvent(userId, plan.id, "step", { type: "approved", index, status: plan.status });

  step.status = "dry_running";
  await step.save();

  let result: ExecResult;
  if (runner) {
    result = await runner(plan.id, index);
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
    await AuditEvent.create({
      type: "step.failed",
      entityId: plan.id,
      userId,
      payload: { index, error: step.error },
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
  await AuditEvent.create({
    type: "step.succeeded",
    entityId: plan.id,
    userId,
    payload: { index, txHash: step.txHash },
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
    await AuditEvent.create({ type: "plan.completed", entityId: plan.id, userId, payload: {} });
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
  await AuditEvent.create({
    type: "plan.cancelled",
    entityId: plan.id,
    userId,
    payload: {},
  });
  publishPlanEvent(userId, plan.id, "plan", { type: "cancelled", status: plan.status });
  return { plan };
}
