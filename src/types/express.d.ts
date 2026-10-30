import type { AuthUser } from "../modules/events/event.types.js";

/**
 * Populated by `requireAuth` / `optionalAuth` after the Better Auth JWT is
 * verified. Controllers read it through `currentUser(request)`.
 */
declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export {};
