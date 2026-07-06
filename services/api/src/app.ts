import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";

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

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
