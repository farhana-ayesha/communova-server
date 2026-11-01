import { z } from "zod";
import { HttpError } from "./http-error.js";

/**
 * Validates a request body/query and converts a Zod failure into the API's
 * shared 422 envelope. The flattened shape is what the client uses to mark
 * individual form fields.
 */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw HttpError.unprocessable(
      "Check the highlighted fields.",
      z.flattenError(result.error),
    );
  }

  return result.data;
}
