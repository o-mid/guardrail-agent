import { AuditEvent, Plan, PlanStep } from "../models/index.js";
import { publishPlanEvent } from "../sse/hub.js";

export type ExecResult = { ok: boolean; txHash?: string; error?: string; dryRunOk?: boolean };

// filled in by chain executors in later commits
let runner: ((planId: string, stepIndex: number) => Promise<ExecResult>) | null = null;

export function setStepRunner(fn: (planId: string, stepIndex: number) => Promise<ExecResult>): void {
  runner = fn;
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
