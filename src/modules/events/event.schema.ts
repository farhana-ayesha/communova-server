import { z } from "zod";
import { EVENT_TYPES } from "./event.types.js";

/**
 * Request validation for the event API. The client validates the same rules in
 * `client/src/lib/validations/event.ts`; this copy is the one that counts.
 */

const futureDate = z
  .string()
  .trim()
  .min(1, "Choose the date of the event.")
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Enter a valid date and time.",
  )
  .transform((value) => new Date(value))
  .refine(
    (date) => date.getTime() > Date.now(),
    "Choose a date in the future.",
  );

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(4, "Use at least 4 characters.")
    .max(100, "Use 100 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(20, "Describe the work in at least 20 characters.")
    .max(2000, "Use 2000 characters or fewer."),
  type: z.enum(EVENT_TYPES, {
    message: "Choose an event type.",
  }),
  thumbnailUrl: z
    .string()
    .trim()
    .min(1, "Add a thumbnail image URL.")
    .max(2048, "That URL is too long.")
    .refine(
      (value) => /^https?:\/\/\S+$/i.test(value),
      "Use a full image URL starting with http:// or https://.",
    ),
  location: z
    .string()
    .trim()
    .min(2, "Add the neighbourhood or meeting point.")
    .max(120, "Use 120 characters or fewer."),
  eventDate: futureDate,
});

export const updateEventSchema = createEventSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Send at least one field to update.",
  });

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type CreateEventBody = z.infer<typeof createEventSchema>;
export type UpdateEventBody = z.infer<typeof updateEventSchema>;
