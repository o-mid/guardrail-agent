import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { walletsRouter } from "./routes/wallets.js";
import { intentsRouter } from "./routes/intents.js";
import { plansRouter } from "./routes/plans.js";
import { auditRouter } from "./routes/audit.js";
import { walletAuthRouter } from "./routes/walletAuth.js";
import { streamRouter } from "./routes/stream.js";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use("/api", healthRouter);
  app.use("/api", authRouter);
  app.use("/api", walletAuthRouter);
  app.use("/api", walletsRouter);
  app.use("/api", intentsRouter);
  app.use("/api", plansRouter);
  app.use("/api", streamRouter);
  app.use("/api", auditRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
