import type { RequestHandler } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-process rate limiter for public write endpoints. It is deliberately
 * simple: one process owns its own buckets, which is enough to stop a single
 * client hammering the newsletter form. A distributed limiter would belong in
 * the edge/proxy layer once the API runs on several instances.
 */
export function rateLimit({
  windowMs,
  max,
  message = "Too many requests. Wait a moment and try again.",
}: {
  windowMs: number;
  max: number;
  message?: string;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let lastSweep = 0;

  return (request, response, next) => {
    const now = Date.now();

    if (now - lastSweep > windowMs) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      lastSweep = now;
    }

    const key = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > max) {
      response.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
      );
      response.status(429).json({
        error: {
          code: "too_many_requests",
          message,
        },
      });
      return;
    }

    next();
  };
}
