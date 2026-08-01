import { AuditEvent, Intent, Plan, PlanStep, Policy } from "../models/index.js";
import { createPlanner } from "../planner/index.js";
import { defaultRules, validatePlan, type PolicyRules } from "../policy/client.js";

const planner = createPlanner();

export async function createIntentFlow(userId: string, text: string, chainHint?: string | null) {
  const intent = await Intent.create({
    userId,
    text,
    status: "planning",
    chainHint: chainHint ?? null,
  });
  await AuditEvent.create({
    type: "intent.received",
    entityId: intent.id,
    userId,
    payload: { text },
  });

  const policy = await loadPolicy(userId);
  let planJson;
  try {
    planJson = await planner.plan({
      intent: text,
      policySummary: policy.rules,
      chainHint,
    });
  } catch (err) {
    intent.status = "planner_unavailable";
    await intent.save();
    await AuditEvent.create({
      type: "intent.planner_unavailable",
      entityId: intent.id,
      userId,
      payload: { error: String(err) },
    });
    return { intent, plan: null };
  }

  let validation;
  try {
    validation = await validatePlan(planJson, { version: policy.version, rules: policy.rules });
  } catch (err) {
    intent.status = "planner_unavailable";
    await intent.save();
    await AuditEvent.create({
      type: "intent.policy_unreachable",
      entityId: intent.id,
      userId,
      payload: { error: String(err) },
    });
    return { intent, plan: null };
  }

  const policyCodes = validation.policyCodes ?? [];
  const schemaErrors = validation.schemaErrors ?? [];
  const humanMessages = validation.humanMessages ?? [];

  if (!validation.ok) {
    const schemaFail = schemaErrors.length > 0;
    intent.status = schemaFail ? "rejected_schema" : "rejected_policy";
    await intent.save();
    const plan = await Plan.create({
      intentId: intent.id,
      userId,
      schemaVersion: planJson.schemaVersion,
      chain: planJson.chain,
      summary: planJson.summary,
      status: schemaFail ? "rejected_schema" : "rejected_policy",
      rawModelJson: planJson,
      rejectionReasons: [...policyCodes, ...schemaErrors],
      policyVersion: policy.version,
    });
    await AuditEvent.create({
      type: schemaFail ? "plan.rejected_schema" : "plan.rejected_policy",
      entityId: plan.id,
      userId,
      payload: {
        policyCodes,
        schemaErrors,
        humanMessages,
      },
    });
    return {
      intent,
      plan,
      validation: { ...validation, policyCodes, schemaErrors, humanMessages },
    };
  }

  const plan = await Plan.create({
    intentId: intent.id,
    userId,
    schemaVersion: planJson.schemaVersion,
    chain: planJson.chain,
    summary: planJson.summary,
    status: "awaiting_approval",
    rawModelJson: planJson,
    rejectionReasons: [],
    policyVersion: policy.version,
  });

  await PlanStep.insertMany(
    planJson.steps.map((step, index) => ({
      planId: plan.id,
      index,
      action: String(step.action),
      payload: step,
      decodedSummary: decodeStep(step),
      status: "pending",
    })),
  );

  intent.status = "planned";
  await intent.save();
  await AuditEvent.create({
    type: "plan.awaiting_approval",
    entityId: plan.id,
    userId,
    payload: { chain: plan.chain, steps: planJson.steps.length },
  });

  return { intent, plan, validation };
}

async function loadPolicy(userId: string): Promise<{ version: number; rules: PolicyRules }> {
  const userPolicy = await Policy.findOne({ scope: userId }).sort({ version: -1 });
  if (userPolicy) {
    return { version: userPolicy.version, rules: userPolicy.rules as PolicyRules };
  }
  const globalPolicy = await Policy.findOne({ scope: "global" }).sort({ version: -1 });
  if (globalPolicy) {
    return { version: globalPolicy.version, rules: globalPolicy.rules as PolicyRules };
  }
  return { version: 1, rules: defaultRules };
}

function decodeStep(step: Record<string, unknown>): string {
  const action = String(step.action);
  if (action === "approve") return `approve ${step.amount} ${step.token} for ${step.spender}`;
  if (action === "swap") return `swap ${step.amountIn} ${step.tokenIn} -> ${step.tokenOut}`;
  if (step.mint) return `transfer ${step.amount} ${step.mint} to ${step.to}`;
  return `transfer ${step.amount} ${step.token} to ${step.to}`;
}
