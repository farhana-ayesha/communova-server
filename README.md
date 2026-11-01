# Communova — API

Express 5 + TypeScript + MongoDB API for
[Communova](https://github.com/farhana-ayesha/communova-client), a community
service events platform. Authentication is issued by the Next.js client (Better
Auth) and verified here as a short-lived JWT against the Better Auth JWKS
endpoint, so this service never stores passwords or session cookies.

## Requirements

- Node.js 20+
- A MongoDB Atlas cluster (or a local MongoDB on `127.0.0.1:27017`)

## Setup

```bash
cp .env.example .env   # then fill in MONGODB_URI and BETTER_AUTH_URL
npm install
npm run dev
```

The API starts on `http://localhost:4000`. If MongoDB is unreachable in
development the process still starts and `GET /health` reports `degraded`; in
production it refuses to start.

## Authentication

The client signs members in with Better Auth and exposes a short-lived JWT from
`/api/auth/token`. This API:

- fetches signing keys from `${BETTER_AUTH_URL}/api/auth/jwks`;
- verifies the issuer, audience, expiry, and allowed algorithms;
- requires the token `sub` and `id` to agree when both are present;
- returns `401` for invalid or expired tokens and `503` when the JWKS endpoint
  is temporarily unreachable.

Every mutating event route and both private list routes require
`Authorization: Bearer <token>`. Ownership is checked against the verified
identity, never against a request body field.

## Endpoints

| Method   | Path                        | Auth | Description                                      |
| -------- | --------------------------- | ---- | ------------------------------------------------ |
| `GET`    | `/health`                   | —    | Liveness + MongoDB ping (200 / 503)              |
| `GET`    | `/api/events`               | —    | Upcoming events, optional `?limit=`              |
| `GET`    | `/api/events/:id`           | opt. | Event detail; personalises `viewerHasJoined`     |
| `POST`   | `/api/events`               | yes  | Create a future event                            |
| `PATCH`  | `/api/events/:id`           | yes  | Update an event you created                      |
| `DELETE` | `/api/events/:id`           | yes  | Delete an event you created                      |
| `POST`   | `/api/events/:id/join`      | yes  | Join an upcoming event (idempotent)              |
| `DELETE` | `/api/events/:id/join`      | yes  | Leave an upcoming event (idempotent)             |
| `GET`    | `/api/events/mine`          | yes  | Events created by the member                     |
| `GET`    | `/api/events/joined`        | yes  | Events the member joined, past ones included     |
| `POST`   | `/api/newsletter`           | —    | Subscribe an email address (idempotent)          |

Responses use `{ "data": ... }`; list responses also include
`{ "meta": { "count": n } }`. Errors use one envelope:
`{ "error": { "code", "message", "details"? } }`.

Newsletter subscriptions are validated, normalised, and stored in MongoDB.
Outbound email delivery is not part of this service; connect a mail provider to
the stored subscriber collection when a dispatch process exists.

### Event date rules

- Creating an event requires a date in the future.
- A future event cannot be moved into the past.
- A past event may keep its original date (compared to the minute) while other
  fields change; it cannot be moved to a different date.
- Past events cannot be joined or left; both return `409`.

## Security and reliability

- `CLIENT_ORIGIN` is a comma-separated allow-list; CORS only echoes configured
  origins.
- JSON and URL-encoded bodies are size-limited, and malformed JSON is a `400`.
- Security headers, `no-store` API responses, and a process-local rate limiter
  are applied to every request.
- Production refuses to start without MongoDB, and `EVENTS_DEV_MEMORY=1` is
  rejected outside development.
- MongoDB indexes are created at boot; event creator details are snapshotted so
  a renamed profile does not rewrite history.

## Environment

| Variable           | Required | Notes                                                    |
| ------------------ | -------- | -------------------------------------------------------- |
| `NODE_ENV`         | no       | `development` by default; use `production` when deployed |
| `MONGODB_URI`      | yes      | Atlas connection string or local `mongodb://` URI        |
| `MONGODB_DB`       | no       | Defaults to `communova`                                  |
| `PORT`             | no       | Defaults to `4000` (Render supplies its own)             |
| `CLIENT_ORIGIN`    | no       | Comma-separated allowed origins                          |
| `BETTER_AUTH_URL`  | yes      | Base URL that serves `/api/auth/jwks`                    |
| `JWT_AUDIENCE`     | no       | Defaults to `communova-api`; must match the client       |
| `EVENTS_DEV_MEMORY`| no       | `1` uses the in-memory register in development only      |

## Testing

```bash
npm run typecheck
npm test
npm run build
```

The integration suite starts the Express app with a local mock JWKS server and
the in-memory register. It covers authentication failures, body parsing, event
ownership and date rules, join/leave idempotency, newsletter persistence, and
CORS.

## Deployment (Render)

The repository includes a `render.yaml` blueprint. To deploy manually:

1. Create a **Web Service** from this repository.
2. Build command: `npm ci && npm run build`
3. Start command: `npm start`
4. Health check path: `/health`
5. Set `NODE_ENV=production`, `MONGODB_URI`, `MONGODB_DB`,
   `BETTER_AUTH_URL`, `CLIENT_ORIGIN`, and `JWT_AUDIENCE`.
6. Add the deployed client origin (and any preview origins) to
   `CLIENT_ORIGIN`. `BETTER_AUTH_URL` must be the deployed client URL, because
   that is the JWT issuer.

Do not set `EVENTS_DEV_MEMORY` in production.

## Conventions

- ESM with `NodeNext` resolution: relative imports use the `.js` extension.
- Express 5 forwards async rejections to the error handler automatically.
- One `MongoClient` per process, cached on `globalThis`.
- Shared event shape lives in `src/modules/events/event.types.ts`; the client
  mirrors it in `src/types/event.ts`.
