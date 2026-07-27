import { Router } from "express";
import { Plan } from "../models/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { subscribe } from "../sse/hub.js";

export const streamRouter = Router();

streamRouter.get("/plans/:id/stream", requireAuth, async (req: AuthedRequest, res) => {
  const plan = await Plan.findOne({ _id: req.params.id, userId: req.userId });
  if (!plan) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: hello\ndata: ${JSON.stringify({ planId: plan.id, status: plan.status })}\n\n`);

  const unsub = subscribe(req.userId!, plan.id, res);
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsub();
  });
});
