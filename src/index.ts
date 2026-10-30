import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeMongo, connectToMongo } from "./db/mongo.js";

async function main(): Promise<void> {
  try {
    await connectToMongo();
    console.log(`[db] connected · ${env.mongoDb}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (env.isProduction) {
      console.error(`[db] unable to connect, refusing to start: ${reason}`);
      process.exit(1);
    }

    console.warn(
      `[db] MongoDB unreachable (${reason}). Starting anyway — /health will report degraded.`,
    );
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[api] ${signal} received · shutting down`);

    server.close(() => {
      void closeMongo().finally(() => process.exit(0));
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
