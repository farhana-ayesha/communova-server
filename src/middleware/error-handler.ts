import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

interface BodyParserError {
  type?: string;
  status?: number;
  statusCode?: number;
  message?: string;
  code?: string | number;
}

function asBodyParserError(error: unknown): BodyParserError | null {
  if (typeof error !== "object" || error === null) return null;

  const candidate = error as BodyParserError;
  if (
    typeof candidate.type === "string" ||
    typeof candidate.status === "number" ||
    typeof candidate.statusCode === "number" ||
    (candidate as { name?: string }).name === "SyntaxError"
  ) {
    return candidate;
  }

  return null;
}

/**
 * `express.json()` throws its own errors before a route runs. They are client
 * mistakes (malformed JSON, oversized payload, unsupported charset), not 500s,
 * so they are translated here instead of being logged as server faults.
 */
function fromBodyParser(error: BodyParserError): HttpError | null {
  const status = error.status ?? error.statusCode;
  const type = error.type ?? "";

  if (type === "entity.parse.failed" || (error as { name?: string }).name === "SyntaxError") {
    return HttpError.badRequest("The request body is not valid JSON.");
  }

  if (type === "entity.too.large") {
    return new HttpError(
      413,
      "payload_too_large",
      "That request is too large. Send a smaller payload.",
    );
  }

  if (type === "encoding.unsupported" || type === "charset.unsupported") {
    return new HttpError(
      415,
      "unsupported_media_type",
      "Use UTF-8 encoded JSON for this request.",
    );
  }

  if (type === "request.aborted" || type === "request.size.invalid") {
    return HttpError.badRequest("The request body was interrupted before it arrived.");
  }

  if (status !== undefined && status >= 400 && status < 500) {
    return new HttpError(status, "bad_request", "The request could not be processed.");
  }

  return null;
}

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

  res.setHeader("Cache-Control", "no-store");

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

  const bodyParserError = asBodyParserError(error);
  const translated = bodyParserError ? fromBodyParser(bodyParserError) : null;

  if (translated) {
    res.status(translated.status).json({
      error: {
        code: translated.code,
        message: translated.message,
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
