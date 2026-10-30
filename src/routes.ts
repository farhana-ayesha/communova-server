import { Router } from "express";

/**
 * Domain API surface. Feature routers (events, participations) mount here so
 * every endpoint shares the `/api` prefix and, later, the JWT guard.
 */
export const apiRouter: Router = Router();
