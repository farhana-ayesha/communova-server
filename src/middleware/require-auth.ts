import { createRemoteJWKSet, jwtVerify } from "jose";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import type { AuthUser } from "../modules/events/event.types.js";

/**
 * Better Auth signs the JWT with a key from its JWKS endpoint. The API verifies
 * signatures against that public key set and never sees a password or session
 * cookie. `jose` caches keys in memory and refetches when it meets a new `kid`,
 * so key rotation within the Next.js process is handled without a restart.
 */
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", env.betterAuthUrl), {
  cacheMaxAge: 10 * 60 * 1000,
  cooldownDuration: 30 * 1000,
  timeoutDuration: 5_000,
});

function bearerToken(request: Request): string | null {
  const header = request.header("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;

  return token.trim() || null;
}

function isInfrastructureError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  return (
    name === "JWKSNoMatchingKey" ||
    name === "JWKSTimeout" ||
    name === "TypeError" ||
    name === "FetchError" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT"
  );
}

async function verify(request: Request): Promise<AuthUser> {
  const token = bearerToken(request);
  if (!token) throw HttpError.unauthorized();

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: env.betterAuthUrl,
      audience: env.jwtAudience,
      algorithms: ["EdDSA", "ES256", "RS256"],
      clockTolerance: 5,
    }));
  } catch (error) {
    if (isInfrastructureError(error)) {
      throw new HttpError(
        503,
        "auth_unavailable",
        "The identity service is not reachable right now.",
      );
    }

    throw HttpError.unauthorized("Your session has expired. Sign in again.");
  }

  const id = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const image = typeof payload.image === "string" ? payload.image.trim() : null;

  // Better Auth includes the user id both as `sub` and (in some versions) `id`.
  // If both are present they must agree; a mismatched token is not trusted.
  const payloadId = typeof payload.id === "string" ? payload.id.trim() : "";
  if (payloadId && payloadId !== id) {
    throw HttpError.unauthorized("Your session identity is inconsistent. Sign in again.");
  }

  if (!id || !email) {
    throw HttpError.unauthorized("Your session is missing an identity. Sign in again.");
  }

  return {
    id,
    email,
    name: name || email.split("@", 1)[0] || email,
    image: image || null,
  };
}

/** Public routes can still personalise a response when a token is present. */
export async function optionalAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  if (!bearerToken(request)) {
    next();
    return;
  }

  try {
    request.authUser = await verify(request);
    next();
  } catch (error) {
    // A malformed token on a public route is treated as a guest, not an error.
    if (error instanceof HttpError && error.status === 503) {
      next(error);
      return;
    }
    next();
  }
}

export async function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    request.authUser = await verify(request);
    next();
  } catch (error) {
    next(error);
  }
}

export function currentUser(request: Request): AuthUser {
  if (!request.authUser) {
    throw HttpError.unauthorized();
  }

  return request.authUser;
}
