import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JWK,
} from "jose";

/**
 * Integration tests for the Express API. They start a tiny JWKS endpoint,
 * mint Better Auth-shaped tokens with a local EdDSA key, and exercise the real
 * Express app against the development memory repositories. No MongoDB or
 * Next.js process is required.
 */

const AUDIENCE = "communova-api";
const KID = "communova-test-key";

type TestUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

const alice: TestUser = {
  id: "user_alice",
  email: "alice@example.com",
  name: "Alice Rahman",
  image: "https://example.com/alice.jpg",
};

const bob: TestUser = {
  id: "user_bob",
  email: "bob@example.com",
  name: "Bob Hasan",
  image: null,
};

let jwksServer: Server;
let apiServer: Server;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let baseUrl: string;

async function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return (server.address() as AddressInfo).port;
}

async function tokenFor(
  user: TestUser,
  overrides: {
    issuer?: string;
    audience?: string;
    subject?: string;
    email?: string | null;
    id?: string;
    expiresIn?: string;
  } = {},
): Promise<string> {
  const payload: Record<string, unknown> = {
    email: overrides.email === undefined ? user.email : overrides.email,
    name: user.name,
    image: user.image ?? null,
    emailVerified: true,
    id: overrides.id ?? user.id,
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", kid: KID })
    .setIssuer(overrides.issuer ?? process.env.BETTER_AUTH_URL!)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setSubject(overrides.subject ?? user.id)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? "5m")
    .sign(privateKey);
}

async function call(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers = new Headers(options.headers);

  if (options.token) headers.set("authorization", `Bearer ${options.token}`);

  let body: string | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? (body !== undefined ? "POST" : "GET"),
    headers,
    body,
  });

  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  return { status: response.status, body: parsed, headers: response.headers };
}

function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test cleanup on the lake road",
    description:
      "A two-hour cleanup of the walking path, with gloves and sacks supplied by the organisers.",
    type: "cleanup",
    thumbnailUrl: "https://example.com/cleanup.jpg",
    location: "Dhanmondi Lake, Dhaka",
    eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

before(async () => {
  const { publicKey, privateKey: signingKey } = await generateKeyPair("EdDSA");
  privateKey = signingKey;

  const jwk = (await exportJWK(publicKey)) as JWK;
  jwk.kid = KID;
  jwk.alg = "EdDSA";
  jwk.use = "sig";

  jwksServer = createServer((request, response) => {
    if (request.url === "/api/auth/jwks") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }

    response.statusCode = 404;
    response.end("not found");
  });

  const authPort = await listen(jwksServer);

  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/communova-test";
  process.env.MONGODB_DB = "communova-test";
  process.env.EVENTS_DEV_MEMORY = "1";
  process.env.JWT_AUDIENCE = AUDIENCE;
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  process.env.BETTER_AUTH_URL = `http://127.0.0.1:${authPort}`;

  // Start from an empty process-local register for deterministic counts.
  delete (globalThis as { __communovaEventsMemory?: unknown }).__communovaEventsMemory;
  delete (globalThis as { __communovaNewsletterMemory?: unknown })
    .__communovaNewsletterMemory;

  const { createApp } = await import("../app.js");
  apiServer = createServer(createApp());
  const apiPort = await listen(apiServer);
  baseUrl = `http://127.0.0.1:${apiPort}`;
});

after(async () => {
  await Promise.all([
    new Promise<void>((resolve) => apiServer?.close(() => resolve())),
    new Promise<void>((resolve) => jwksServer?.close(() => resolve())),
  ]);
});

test("health reports the memory register as ready", async () => {
  const response = await call("/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.database, "memory");
});

test("private routes reject a missing token", async () => {
  const response = await call("/api/events/mine");

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "unauthorized");
});

test("tokens with the wrong audience, issuer, or identity are rejected", async () => {
  const wrongAudience = await tokenFor(alice, { audience: "another-api" });
  const wrongIssuer = await tokenFor(alice, { issuer: "http://example.com" });
  const wrongIdentity = await tokenFor(alice, { id: "user_someone_else" });
  const missingEmail = await tokenFor(alice, { email: null });

  for (const token of [wrongAudience, wrongIssuer, wrongIdentity, missingEmail]) {
    const response = await call("/api/events/mine", { token });
    assert.equal(response.status, 401);
  }
});

test("malformed JSON is a 400, not an internal error", async () => {
  const token = await tokenFor(alice);
  const response = await call("/api/events", {
    token,
    rawBody: "{ this is not json",
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "bad_request");
});

test("a member can create a future event and the creator photo is snapshotted", async () => {
  const token = await tokenFor(alice);
  const response = await call("/api/events", {
    token,
    body: eventPayload({ title: "Alice creates a cleanup" }),
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.title, "Alice creates a cleanup");
  assert.equal(response.body.data.creator.id, alice.id);
  assert.equal(response.body.data.creator.image, alice.image);
  assert.equal(response.body.data.participantCount, 0);
});

test("creating an event in the past is refused", async () => {
  const token = await tokenFor(alice);
  const response = await call("/api/events", {
    token,
    body: eventPayload({
      title: "A cleanup that already happened",
      eventDate: new Date(Date.now() - 60_000).toISOString(),
    }),
  });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "validation_error");
  assert.ok(response.body.error.details.fieldErrors.eventDate);
});

test("only the creator can edit an event", async () => {
  const aliceToken = await tokenFor(alice);
  const bobToken = await tokenFor(bob);

  const created = await call("/api/events", {
    token: aliceToken,
    body: eventPayload({ title: "Alice owns this event" }),
  });
  assert.equal(created.status, 201);

  const response = await call(`/api/events/${created.body.data.id}`, {
    method: "PATCH",
    token: bobToken,
    body: { title: "Bob tries to take it over" },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "forbidden");
});

test("a future event cannot be moved into the past", async () => {
  const token = await tokenFor(alice);
  const created = await call("/api/events", {
    token,
    body: eventPayload({ title: "Future event date guard" }),
  });

  const response = await call(`/api/events/${created.body.data.id}`, {
    method: "PATCH",
    token,
    body: { eventDate: new Date(Date.now() - 60_000).toISOString() },
  });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "validation_error");
});

test("a past event keeps its date but other fields can still change", async () => {
  const { MemoryEventsRepository } = await import(
    "../modules/events/event.memory.js"
  );
  const repository = new MemoryEventsRepository();
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const past = await repository.create(
    {
      title: "Past cleanup kept as a record",
      description:
        "This event already happened and should stay on the record with its original date.",
      type: "cleanup",
      thumbnailUrl: "https://example.com/past.jpg",
      location: "Ramna Park, Dhaka",
      eventDate: pastDate,
    },
    alice,
  );

  const token = await tokenFor(alice);
  const unchanged = await call(`/api/events/${past.id}`, {
    method: "PATCH",
    token,
    body: {
      location: "Ramna Park, Minto Road gate",
      eventDate: past.eventDate,
    },
  });

  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.body.data.location, "Ramna Park, Minto Road gate");

  const moved = await call(`/api/events/${past.id}`, {
    method: "PATCH",
    token,
    body: { eventDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  });

  assert.equal(moved.status, 422);
  assert.ok(moved.body.error.details.fieldErrors.eventDate);
});

test("joining is idempotent, leaving is idempotent, and the count follows", async () => {
  const aliceToken = await tokenFor(alice);
  const bobToken = await tokenFor(bob);

  const created = await call("/api/events", {
    token: aliceToken,
    body: eventPayload({ title: "Join and leave count test" }),
  });
  const id = created.body.data.id;

  const firstJoin = await call(`/api/events/${id}/join`, {
    method: "POST",
    token: bobToken,
  });
  assert.equal(firstJoin.status, 200);
  assert.equal(firstJoin.body.data.viewerHasJoined, true);
  assert.equal(firstJoin.body.data.event.participantCount, 1);

  const duplicateJoin = await call(`/api/events/${id}/join`, {
    method: "POST",
    token: bobToken,
  });
  assert.equal(duplicateJoin.status, 200);
  assert.equal(duplicateJoin.body.data.event.participantCount, 1);

  const leave = await call(`/api/events/${id}/join`, {
    method: "DELETE",
    token: bobToken,
  });
  assert.equal(leave.status, 200);
  assert.equal(leave.body.data.viewerHasJoined, false);
  assert.equal(leave.body.data.event.participantCount, 0);

  const duplicateLeave = await call(`/api/events/${id}/join`, {
    method: "DELETE",
    token: bobToken,
  });
  assert.equal(duplicateLeave.status, 200);
  assert.equal(duplicateLeave.body.data.event.participantCount, 0);
});

test("past events cannot be joined or left", async () => {
  const { MemoryEventsRepository } = await import(
    "../modules/events/event.memory.js"
  );
  const repository = new MemoryEventsRepository();
  const past = await repository.create(
    {
      title: "A closed cleanup",
      description:
        "This event is already in the past and its participation record is closed.",
      type: "cleanup",
      thumbnailUrl: "https://example.com/closed.jpg",
      location: "Old Dhaka",
      eventDate: new Date(Date.now() - 60_000),
    },
    alice,
  );

  const bobToken = await tokenFor(bob);

  const join = await call(`/api/events/${past.id}/join`, {
    method: "POST",
    token: bobToken,
  });
  assert.equal(join.status, 409);
  assert.equal(join.body.error.code, "conflict");

  const leave = await call(`/api/events/${past.id}/join`, {
    method: "DELETE",
    token: bobToken,
  });
  assert.equal(leave.status, 409);
  assert.equal(leave.body.error.code, "conflict");
});

test("newsletter subscriptions are validated, persisted, and idempotent", async () => {
  const first = await call("/api/newsletter", {
    body: { email: "Reader@Example.com" },
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.email, "reader@example.com");
  assert.equal(first.body.data.alreadySubscribed, false);

  const duplicate = await call("/api/newsletter", {
    body: { email: "reader@example.com" },
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.data.alreadySubscribed, true);

  const invalid = await call("/api/newsletter", {
    body: { email: "not-an-email" },
  });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.code, "validation_error");
});

test("CORS only echoes configured origins", async () => {
  const allowed = await call("/api/events", {
    headers: { origin: "http://localhost:3000" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );

  const blocked = await call("/api/events", {
    headers: { origin: "https://evil.example" },
  });
  assert.equal(blocked.headers.get("access-control-allow-origin"), null);
});
