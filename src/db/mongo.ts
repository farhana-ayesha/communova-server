import { MongoClient, type Db } from "mongodb";
import { env } from "../config/env.js";

interface MongoState {
  client: MongoClient;
  db: Db;
}

/**
 * A single client per process. In dev this survives `tsx watch` module reloads,
 * and in production it keeps the pool inside Atlas' connection limits.
 */
const globalForMongo = globalThis as typeof globalThis & {
  __communovaMongo?: MongoState;
};

function createState(): MongoState {
  const client = new MongoClient(env.mongoUri, {
    appName: "communova-api",
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5_000,
  });

  return { client, db: client.db(env.mongoDb) };
}

function state(): MongoState {
  globalForMongo.__communovaMongo ??= createState();
  return globalForMongo.__communovaMongo;
}

export function getMongoClient(): MongoClient {
  return state().client;
}

export function getMongoDb(): Db {
  return state().db;
}

export async function connectToMongo(): Promise<void> {
  const { client, db } = state();
  await client.connect();
  await db.command({ ping: 1 });
}

export async function pingMongo(timeoutMs = 2_000): Promise<boolean> {
  const ping = state()
    .db.command({ ping: 1 })
    .then(() => true)
    .catch(() => false);

  const timeout = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref?.();
  });

  return Promise.race([ping, timeout]);
}

export async function closeMongo(): Promise<void> {
  if (!globalForMongo.__communovaMongo) return;
  await globalForMongo.__communovaMongo.client.close();
  globalForMongo.__communovaMongo = undefined;
}
