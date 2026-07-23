import { Router } from "express";
import { AuditEvent } from "../models/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const auditRouter = Router();

auditRouter.get("/audit", requireAuth, async (req: AuthedRequest, res) => {
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const filter: Record<string, unknown> = { userId: req.userId };
  if (entityId) filter.entityId = entityId;
  const events = await AuditEvent.find(filter).sort({ createdAt: -1 }).limit(limit);
  res.json({ events });
});
