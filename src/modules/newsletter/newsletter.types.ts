import type { ObjectId } from "mongodb";

/** One row per subscribed address. The unique index makes repeat submits idempotent. */
export interface NewsletterSubscriberDocument {
  _id: ObjectId;
  email: string;
  source: string;
  createdAt: Date;
}

export interface NewsletterSubscription {
  email: string;
  alreadySubscribed: boolean;
}

export interface NewsletterRepository {
  /** Returns true when this address was newly inserted. */
  subscribe(email: string, source: string): Promise<boolean>;
}
