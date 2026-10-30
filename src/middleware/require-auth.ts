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
const jwks = createRemoteJWKSet(new URL(`${env.betterAuthUrl}/api/auth/jwks`), {
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

async function verify(request: Request): Promise<AuthUser> {
  const token = bearerToken(request);
  if (!token) throw HttpError.unauthorized();

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: env.betterAuthUrl,
      audience: env.jwtAudience,
    }));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (
      name === "JWKSNoMatchingKey" ||
      name === "JWKSTimeout" ||
      name === "TypeError"
    ) {
      throw new HttpError(
        503,
        "auth_unavailable",
        "The identity service is not reachable right now.",
      );
    }

    throw HttpError.unauthorized("Your session has expired. Sign in again.");
  }

  const id = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  const name = typeof payload.name === "string" ? payload.name : "";

  if (!id || !email) {
    throw HttpError.unauthorized("Your session is missing an identity. Sign in again.");
  }

  return { id, email, name: name || email.split("@", 1)[0] || email };
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
