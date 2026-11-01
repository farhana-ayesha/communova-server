import "dotenv/config";
import { z } from "zod";

/**
 * Environment contract for the API.
 * Fails fast with a readable report instead of surfacing `undefined` deep in a
 * request. Production is deliberately stricter than development: an in-memory
 * register or a malformed Mongo URI must never reach a live deployment.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z
      .string()
      .trim()
      .min(1, "MONGODB_URI is required (Atlas connection string or local mongodb:// URI)")
      .refine(
        (value) =>
          value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
        "MONGODB_URI must start with mongodb:// or mongodb+srv://",
      ),
    MONGODB_DB: z.string().trim().min(1).default("communova"),
    CLIENT_ORIGIN: z
      .string()
      .trim()
      .min(1)
      .default("http://localhost:3000"),
    BETTER_AUTH_URL: z
      .string()
      .trim()
      .min(1)
      .default("http://localhost:3000")
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }, "BETTER_AUTH_URL must be an absolute http(s) URL"),
    /** Audience this API accepts. Must match the Better Auth JWT plugin. */
    JWT_AUDIENCE: z.string().trim().min(1).default("communova-api"),
    /**
     * Development only: keep events and newsletter subscriptions in a
     * process-local store when no mongod is reachable. Never honoured in
     * production.
     */
    EVENTS_DEV_MEMORY: z
      .enum(["0", "1"])
      .default("0")
      .transform((value) => value === "1"),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.EVENTS_DEV_MEMORY) {
      ctx.addIssue({
        code: "custom",
        path: ["EVENTS_DEV_MEMORY"],
        message: "EVENTS_DEV_MEMORY is development-only and is refused in production.",
      });
    }

    const origins = value.CLIENT_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (origins.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["CLIENT_ORIGIN"],
        message: "CLIENT_ORIGIN must list at least one origin.",
      });
    }

    for (const origin of origins) {
      try {
        const url = new URL(origin);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["CLIENT_ORIGIN"],
          message: `CLIENT_ORIGIN contains an invalid origin: ${origin}`,
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const report = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  console.error(`Invalid environment configuration:\n${report}`);
  process.exit(1);
}

const raw = parsed.data;

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * `CLIENT_ORIGIN` accepts a comma-separated list so local, preview, and
 * production front-ends can be allowed at once.
 */
const allowedOrigins = raw.CLIENT_ORIGIN.split(",")
  .map((origin) => withoutTrailingSlash(origin.trim()))
  .filter(Boolean);

export const env = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  isTest: raw.NODE_ENV === "test",
  port: raw.PORT,
  mongoUri: raw.MONGODB_URI,
  mongoDb: raw.MONGODB_DB,
  allowedOrigins,
  betterAuthUrl: withoutTrailingSlash(raw.BETTER_AUTH_URL),
  jwtAudience: raw.JWT_AUDIENCE,
  eventsDevMemory: raw.EVENTS_DEV_MEMORY,
});

export type Env = typeof env;
