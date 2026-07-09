import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/tokens.js";

export type AuthedRequest = Request & { userId?: string; userEmail?: string };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const claims = verifyAccessToken(header.slice(7));
    req.userId = claims.sub;
    req.userEmail = claims.email;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}
