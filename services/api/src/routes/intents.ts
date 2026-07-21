import { Router } from "express";
import { z } from "zod";
import { Intent, Plan, PlanStep } from "../models/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createIntentFlow } from "../services/intentPipeline.js";

export const intentsRouter = Router();

const createSchema = z.object({
  text: z.string().min(1).max(500),
  chainHint: z.enum(["anvil", "solana-local"]).optional(),
});

intentsRouter.post("/intents", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const result = await createIntentFlow(req.userId!, parsed.data.text, parsed.data.chainHint);
  const steps = result.plan ? await PlanStep.find({ planId: result.plan.id }).sort({ index: 1 }) : [];
  res.status(201).json({
    intent: result.intent,
    plan: result.plan,
    steps,
    validation: result.validation ?? null,
  });
});

intentsRouter.get("/intents/:id", requireAuth, async (req: AuthedRequest, res) => {
  const intent = await Intent.findOne({ _id: req.params.id, userId: req.userId });
  if (!intent) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const plan = await Plan.findOne({ intentId: intent.id, userId: req.userId });
  res.json({ intent, plan });
});
