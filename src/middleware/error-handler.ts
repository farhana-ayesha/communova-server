import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "not_found",
      message: `No route matches ${req.method} ${req.originalUrl}`,
    },
  });
}

/**
 * Express 5 forwards rejected promises here automatically, so controllers
 * can be plain `async` functions without a try/catch wrapper.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  console.error("[api] unhandled error", error);

  res.status(500).json({
    error: {
      code: "internal_error",
      message: env.isProduction
        ? "Something went wrong on our side."
        : error instanceof Error
          ? error.message
          : String(error),
    },
  });
}
