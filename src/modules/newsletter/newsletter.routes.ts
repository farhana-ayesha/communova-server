import { Router } from "express";
import { rateLimit } from "../../middleware/rate-limit.js";
import { parse } from "../../utils/parse.js";
import { newsletterSchema } from "./newsletter.schema.js";
import { subscribeToNewsletter } from "./newsletter.service.js";

export const newsletterRouter: Router = Router();

const newsletterLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: "Too many subscribe attempts. Wait a few minutes and try again.",
});

/**
 * Public newsletter sign-up. Repeat submits are successful and idempotent;
 * `alreadySubscribed` lets the client acknowledge an existing address without
 * pretending a second row was written.
 */
newsletterRouter.post("/", newsletterLimiter, async (request, response) => {
  const { email } = parse(newsletterSchema, request.body);
  const subscription = await subscribeToNewsletter(email);

  response
    .status(subscription.alreadySubscribed ? 200 : 201)
    .json({ data: subscription });
});
