import type { ObjectId } from "mongodb";

/**
 * Shared event contract. The client mirrors this in `client/src/types/event.ts`
 * — keep the two in sync when the shape changes.
 */
export const EVENT_TYPES = [
  "cleanup",
  "plantation",
  "donation",
  "education",
  "health",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** Collection names shared with Better Auth (it owns the first five). */
export const COLLECTIONS = {
  users: "user",
  sessions: "session",
  accounts: "account",
  verifications: "verification",
  jwks: "jwks",
  events: "events",
  participations: "participations",
} as const;

/** Shape stored in MongoDB. */
export interface EventDocument {
  _id: ObjectId;
  title: string;
  description: string;
  type: EventType;
  thumbnailUrl: string;
  location: string;
  eventDate: Date;
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  participantCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape sent over HTTP (dates as ISO strings, `_id` as `id`). */
export interface EventDto {
  id: string;
  title: string;
  description: string;
  type: EventType;
  thumbnailUrl: string;
  location: string;
  eventDate: string;
  participantCount: number;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}
