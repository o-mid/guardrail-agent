import { Router } from "express";
import { Plan, PlanStep } from "../models/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { approveStep, rejectPlan } from "../services/execution.js";

export const plansRouter = Router();

plansRouter.get("/plans/:id", requireAuth, async (req: AuthedRequest, res) => {
  const plan = await Plan.findOne({ _id: req.params.id, userId: req.userId });
  if (!plan) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const steps = await PlanStep.find({ planId: plan.id }).sort({ index: 1 });
  res.json({ plan, steps });
});

plansRouter.post("/plans/:id/steps/:index/approve", requireAuth, async (req: AuthedRequest, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) {
    res.status(400).json({ error: "invalid_index" });
    return;
  }
  const result = await approveStep(req.userId!, req.params.id, index);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 409;
    if (result.error === "rejected_policy") {
      res.status(status).json({
        error: result.error,
        policyCodes: result.policyCodes,
        schemaErrors: result.schemaErrors,
        humanMessages: result.humanMessages,
      });
      return;
    }
    res.status(status).json({ error: result.error });
    return;
  }
  const steps = await PlanStep.find({ planId: result.plan.id }).sort({ index: 1 });
  res.json({ plan: result.plan, step: result.step, steps, noop: "noop" in result ? result.noop : false });
});

plansRouter.post("/plans/:id/reject", requireAuth, async (req: AuthedRequest, res) => {
  const result = await rejectPlan(req.userId!, req.params.id);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 409;
    res.status(status).json({ error: result.error });
    return;
  }
  const steps = await PlanStep.find({ planId: result.plan.id }).sort({ index: 1 });
  res.json({ plan: result.plan, steps });
});
