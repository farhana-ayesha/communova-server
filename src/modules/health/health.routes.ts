import { Router } from "express";
import { pingMongo } from "../../db/mongo.js";

const startedAt = Date.now();

export const healthRouter: Router = Router();

/**
 * Liveness + readiness probe used by Render and by the client's warm-up call.
 * Returns 503 when the database is unreachable so a deploy is never marked
 * healthy while it cannot serve data.
 */
healthRouter.get("/health", async (_req, res) => {
  const databaseUp = await pingMongo();

  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? "ok" : "degraded",
    service: "communova-api",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    database: databaseUp ? "up" : "down",
    timestamp: new Date().toISOString(),
  });
});
