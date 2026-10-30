import { Router } from "express";
import { env } from "../../config/env.js";
import { pingMongo } from "../../db/mongo.js";

const startedAt = Date.now();

export const healthRouter: Router = Router();

/**
 * Liveness + readiness probe used by Render and by the client's warm-up call.
 * Returns 503 when the database is unreachable so a deploy is never marked
 * healthy while it cannot serve data. In the dev-only memory mode the register
 * is healthy by definition.
 */
healthRouter.get("/health", async (_req, res) => {
  const databaseUp = env.eventsDevMemory ? true : await pingMongo();

  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? "ok" : "degraded",
    service: "communova-api",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    database: env.eventsDevMemory ? "memory" : databaseUp ? "up" : "down",
    timestamp: new Date().toISOString(),
  });
});
