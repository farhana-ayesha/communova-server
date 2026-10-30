import "dotenv/config";
import { z } from "zod";

/**
 * Environment contract for the API.
 * Fails fast with a readable report instead of surfacing `undefined` deep in a request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required (Atlas connection string or local mongodb:// URI)"),
  MONGODB_DB: z.string().min(1).default("communova"),
  CLIENT_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:3000"),
  BETTER_AUTH_URL: z.string().min(1).default("http://localhost:3000"),
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

/**
 * `CLIENT_ORIGIN` accepts a comma-separated list so local, preview, and
 * production front-ends can be allowed at once.
 */
const allowedOrigins = raw.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  port: raw.PORT,
  mongoUri: raw.MONGODB_URI,
  mongoDb: raw.MONGODB_DB,
  allowedOrigins,
  betterAuthUrl: raw.BETTER_AUTH_URL.replace(/\/+$/, ""),
});

export type Env = typeof env;
