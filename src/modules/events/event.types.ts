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
  newsletterSubscribers: "newsletterSubscribers",
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
  creatorImage: string | null;
  participantCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** One row per member per event. The unique index makes joining idempotent. */
export interface ParticipationDocument {
  _id: ObjectId;
  eventId: ObjectId;
  userId: string;
  userEmail: string;
  userName: string;
  joinedAt: Date;
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
    image: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EventInput {
  title: string;
  description: string;
  type: EventType;
  thumbnailUrl: string;
  location: string;
  eventDate: Date;
}

export type EventPatch = Partial<EventInput>;

/** The verified identity carried by a Better Auth JWT. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

export interface EventView {
  event: EventDto;
  viewerHasJoined: boolean;
}

/**
 * Storage contract. MongoDB is the production path; the in-memory store keeps
 * the same semantics for local work on a machine without a reachable mongod.
 */
export interface EventsRepository {
  listUpcoming(limit?: number): Promise<EventDto[]>;
  findById(id: string): Promise<EventDto | null>;
  listByCreator(creatorId: string): Promise<EventDto[]>;
  listJoinedByUser(userId: string): Promise<EventDto[]>;
  hasJoined(eventId: string, userId: string): Promise<boolean>;
  create(input: EventInput, creator: AuthUser): Promise<EventDto>;
  update(id: string, patch: EventPatch): Promise<EventDto | null>;
  remove(id: string): Promise<boolean>;
  /** Returns true when the row was newly inserted. */
  join(eventId: string, user: AuthUser): Promise<boolean>;
  /** Returns true when an existing row was removed. */
  leave(eventId: string, userId: string): Promise<boolean>;
}

export function toEventDto(document: {
  _id: ObjectId | string;
  title: string;
  description: string;
  type: EventType;
  thumbnailUrl: string;
  location: string;
  eventDate: Date;
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  creatorImage: string | null;
  participantCount: number;
  createdAt: Date;
  updatedAt: Date;
}): EventDto {
  return {
    id: String(document._id),
    title: document.title,
    description: document.description,
    type: document.type,
    thumbnailUrl: document.thumbnailUrl,
    location: document.location,
    eventDate: document.eventDate.toISOString(),
    participantCount: document.participantCount,
    creator: {
      id: document.creatorId,
      name: document.creatorName,
      email: document.creatorEmail,
      image: document.creatorImage ?? null,
    },
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
