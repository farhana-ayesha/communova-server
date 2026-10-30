import { Router } from "express";
import { eventsRouter } from "./modules/events/event.routes.js";

/**
 * Domain API surface. Feature routers mount here so every endpoint shares the
 * `/api` prefix and the same JWT guard.
 */
export const apiRouter: Router = Router();

apiRouter.use("/events", eventsRouter);
