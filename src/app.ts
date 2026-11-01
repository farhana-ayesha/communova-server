import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { apiRouter } from "./routes.js";

/**
 * Security headers for a JSON API. The client is a separate origin, so no
 * CSP is set here; these headers stop MIME sniffing, framing, and referrer
 * leakage without interfering with CORS.
 */
function securityHeaders(): RequestHandler {
  return (_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    if (env.isProduction) {
      response.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }

    next();
  };
}

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.set("json escape", true);

  app.use(securityHeaders());

  app.use(
    cors({
      origin(requestOrigin, callback) {
        // Same-origin/server-to-server requests have no Origin header. Browsers
        // only receive CORS headers when their origin is explicitly listed.
        callback(
          null,
          !requestOrigin || env.allowedOrigins.includes(requestOrigin),
        );
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86_400,
    }),
  );

  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use(healthRouter);
  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
