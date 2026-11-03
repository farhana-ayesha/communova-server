Communova Server

A RESTful backend API for Communova, an event management platform where users can create events, explore upcoming events, join events, and manage their activities.

# Communova — API

Express 5 + TypeScript + MongoDB API for
[Communova](https://github.com/farhana-ayesha/communova-client), a social
development events platform where residents create, join, and track community
service events.

Authentication is issued by the Next.js client (Better Auth) and verified here
as a short-lived JWT against the Better Auth JWKS endpoint, so this service
never stores passwords or session cookies.

- Live API: https://communova-server.onrender.com
- Health check: https://communova-server.onrender.com/health
- Client repository: https://github.com/farhana-ayesha/communova-client

> The API runs on a free Render instance. After a period of inactivity the first
> request can take up to a minute while the service wakes up.

## Features

- Event CRUD with ownership checks: only the member who created an event can
  update or delete it.
- Join and leave an event, with participant counts stored alongside the event.
- Member-specific lists: events created by the member and events they joined.
- JWT verification against the Better Auth JWKS endpoint on protected routes.
- Newsletter subscriptions with validation and a rate limiter.
- Security headers, CORS allow-list, request body size limits, and a shared
  error envelope.

## Requirements

- Node.js 20+
- A MongoDB Atlas cluster (or a local MongoDB on `127.0.0.1:27017`)

## Setup

```bash
git clone https://github.com/farhana-ayesha/communova-server.git
cd communova-server
cp .env.example .env   # then fill in MONGODB_URI and BETTER_AUTH_URL
npm install
npm run dev
```

The API starts on `http://localhost:4000`. If MongoDB is unreachable in
development the process still starts and `GET /health` reports `degraded`; in
production it refuses to start.

## Scripts

| Script              | Purpose                     |
| ------------------- | --------------------------- |
| `npm run dev`       | Watch mode via `tsx`        |
| `npm run build`     | Compile to `dist/`          |
| `npm start`         | Run the compiled server     |
| `npm run typecheck` | Type-check without emitting |

## Endpoints

Domain routes mount under `/api`. **Auth** means a valid Better Auth JWT in the
`Authorization: Bearer <token>` header.

| Method   | Path                   | Auth     | Description                                       |
| -------- | ---------------------- | -------- | ------------------------------------------------- |
| `GET`    | `/health`              | —        | Liveness + MongoDB ping (200 / 503)               |
| `GET`    | `/api/events`          | —        | List events                                       |
| `GET`    | `/api/events/mine`     | required | Events created by the signed-in member            |
| `GET`    | `/api/events/joined`   | required | Events the signed-in member has joined            |
| `GET`    | `/api/events/:id`      | optional | Event details (public; token adds member context) |
| `POST`   | `/api/events`          | required | Create an event                                   |
| `PATCH`  | `/api/events/:id`      | required | Update an event (owner only)                      |
| `DELETE` | `/api/events/:id`      | required | Delete an event (owner only)                      |
| `POST`   | `/api/events/:id/join` | required | Join an event                                     |
| `DELETE` | `/api/events/:id/join` | required | Leave an event                                    |
| `POST`   | `/api/newsletter`      | —        | Subscribe an email address (rate limited)         |

## Conventions

- ESM with `NodeNext` resolution: relative imports use the `.js` extension.
- Errors share one envelope: `{ "error": { "code", "message", "details"? } }`.
- Express 5 forwards async rejections to the error handler automatically.
- One `MongoClient` per process, cached on `globalThis`.

## Environment

| Variable            | Required | Notes                                                                   |
| ------------------- | -------- | ----------------------------------------------------------------------- |
| `MONGODB_URI`       | yes      | Atlas connection string or local URI                                    |
| `MONGODB_DB`        | no       | Defaults to `communova`                                                 |
| `PORT`              | no       | Defaults to `4000`                                                      |
| `CLIENT_ORIGIN`     | no       | Comma-separated allowed origins (set to the client URL)                 |
| `BETTER_AUTH_URL`   | yes      | Base URL that serves `/api/auth/jwks` (the client origin)               |
| `EVENTS_DEV_MEMORY` | no       | `1` uses a process-local register in development; refused in production |

Never commit `.env` or production secrets.

## Deployment (Render)

1. Create a Web Service on Render using this repository and the `main` branch.
2. Set the build command:

   ```bash
   npm install --include=dev && npm run build
   ```

3. Set the start command:

   ```bash
   npm start
   ```

4. Configure the required environment variables in Render:
   - `MONGODB_URI`
   - `MONGODB_DB`
   - `CLIENT_ORIGIN`
   - `BETTER_AUTH_URL`
   - `JWT_AUDIENCE`
   - `NODE_ENV=production`

   Set `CLIENT_ORIGIN` and `BETTER_AUTH_URL` to the production client URL. Do not enable `EVENTS_DEV_MEMORY` in production.

5. In MongoDB Atlas, configure **Network Access** to allow connections from your Render service.
6. Set the client's `NEXT_PUBLIC_API_URL` to the deployed API URL and redeploy the client.
7. Verify the deployment using the `/health` endpoint.
