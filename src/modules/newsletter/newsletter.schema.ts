import { z } from "zod";

/**
 * Public newsletter sign-up. Addresses are normalised to lower case so the
 * unique index treats `A@example.com` and `a@example.com` as one subscriber.
 */
export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your email address.")
    .max(254, "That email address is too long.")
    .email("Enter a valid email address, like you@example.com."),
});

export type NewsletterBody = z.infer<typeof newsletterSchema>;
