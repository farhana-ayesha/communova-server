import { ObjectId, type Collection, type Db } from "mongodb";
import { getMongoDb } from "../../db/mongo.js";
import { COLLECTIONS } from "../events/event.types.js";
import type {
  NewsletterRepository,
  NewsletterSubscriberDocument,
} from "./newsletter.types.js";

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export class MongoNewsletterRepository implements NewsletterRepository {
  private readonly db: Db;

  constructor(db: Db = getMongoDb()) {
    this.db = db;
  }

  private get subscribers(): Collection<NewsletterSubscriberDocument> {
    return this.db.collection<NewsletterSubscriberDocument>(
      COLLECTIONS.newsletterSubscribers,
    );
  }

  async subscribe(email: string, source: string): Promise<boolean> {
    try {
      const result = await this.subscribers.updateOne(
        { email },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            email,
            source,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      return result.upsertedCount === 1;
    } catch (error) {
      // Two simultaneous submits can race between the lookup and insert. The
      // unique index wins; the second request is still a successful subscribe.
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }
}

export async function ensureNewsletterIndexes(db: Db = getMongoDb()): Promise<void> {
  await db
    .collection(COLLECTIONS.newsletterSubscribers)
    .createIndex({ email: 1 }, { unique: true });
}
