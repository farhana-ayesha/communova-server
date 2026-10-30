/**
 * Transport-agnostic error carrying an HTTP status and a stable machine code.
 * Thrown from services/controllers and translated once by the error handler.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  static badRequest(message = "The request could not be processed.", details?: unknown) {
    return new HttpError(400, "bad_request", message, details);
  }

  static unauthorized(message = "You need to sign in to do that.") {
    return new HttpError(401, "unauthorized", message);
  }

  static forbidden(message = "You do not have access to this resource.") {
    return new HttpError(403, "forbidden", message);
  }

  static notFound(message = "The requested resource does not exist.") {
    return new HttpError(404, "not_found", message);
  }

  static conflict(message = "That resource already exists.", details?: unknown) {
    return new HttpError(409, "conflict", message, details);
  }

  static unprocessable(message = "Validation failed.", details?: unknown) {
    return new HttpError(422, "validation_error", message, details);
  }
}
