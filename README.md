# Communova — API

Express 5 + TypeScript + MongoDB API for [Communova](https://github.com/), a social
development events platform. Authentication is issued by the Next.js client
(Better Auth) and verified here as a short-lived JWT against the Better Auth JWKS
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

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Watch mode via `tsx`             |
| `npm run build`     | Compile to `dist/`               |
| `npm start`         | Run the compiled server          |
| `npm run typecheck` | Type-check without emitting      |

## Endpoints

| Method | Path      | Auth | Description                          |
| ------ | --------- | ---- | ------------------------------------ |
| `GET`  | `/health` | —    | Liveness + MongoDB ping (200 / 503)  |

Domain routes mount under `/api` and will be added in later phases.

## Conventions

- ESM with `NodeNext` resolution: relative imports use the `.js` extension.
- Errors share one envelope: `{ "error": { "code", "message", "details"? } }`.
- Express 5 forwards async rejections to the error handler automatically.
- One `MongoClient` per process, cached on `globalThis`.

## Environment

| Variable          | Required | Notes                                        |
| ----------------- | -------- | -------------------------------------------- |
| `MONGODB_URI`     | yes      | Atlas connection string or local URI         |
| `MONGODB_DB`      | no       | Defaults to `communova`                      |
| `PORT`            | no       | Defaults to `4000`                           |
| `CLIENT_ORIGIN`   | no       | Comma-separated allowed origins              |
| `BETTER_AUTH_URL` | yes      | Base URL that serves `/api/auth/jwks`        |
