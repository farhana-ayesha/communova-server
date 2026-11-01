import { randomUUID } from "node:crypto";
import { buildSeedEvents } from "./event.seed.js";
import {
  toEventDto,
  type AuthUser,
  type EventDto,
  type EventInput,
  type EventPatch,
  type EventsRepository,
} from "./event.types.js";

/**
 * Process-local mirror of the Mongo repository, used only when
 * `EVENTS_DEV_MEMORY=1`. It keeps the same ordering and idempotency rules so the
 * UI can be developed on a machine where mongod cannot start.
 */

type StoredEvent = EventInput & {
  id: string;
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  creatorImage: string | null;
  participantCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type StoredParticipation = {
  eventId: string;
  userId: string;
  userEmail: string;
  userName: string;
  joinedAt: Date;
};

interface MemoryStore {
  events: StoredEvent[];
  participations: StoredParticipation[];
}

const globalForEvents = globalThis as typeof globalThis & {
  __communovaEventsMemory?: MemoryStore;
};

function seed(): MemoryStore {
  const now = Date.now();
  const events: StoredEvent[] = buildSeedEvents(now).map((seedEvent, index) => {
    const createdAt = new Date(now - (index + 1) * 60 * 60 * 1000);

    return {
      ...seedEvent.input,
      id: randomUUID(),
      creatorId: seedEvent.creator.id,
      creatorEmail: seedEvent.creator.email,
      creatorName: seedEvent.creator.name,
      creatorImage: seedEvent.creator.image ?? null,
      participantCount: seedEvent.participantCount,
      createdAt,
      updatedAt: createdAt,
    };
  });

  return { events, participations: [] };
}

function store(): MemoryStore {
  globalForEvents.__communovaEventsMemory ??= seed();
  return globalForEvents.__communovaEventsMemory;
}

function byDateThenCreated(a: StoredEvent, b: StoredEvent): number {
  return (
    a.eventDate.getTime() - b.eventDate.getTime() ||
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

function toDto(event: StoredEvent): EventDto {
  return toEventDto({
    _id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    thumbnailUrl: event.thumbnailUrl,
    location: event.location,
    eventDate: event.eventDate,
    creatorId: event.creatorId,
    creatorEmail: event.creatorEmail,
    creatorName: event.creatorName,
    creatorImage: event.creatorImage,
    participantCount: event.participantCount,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  });
}

export class MemoryEventsRepository implements EventsRepository {
  async listUpcoming(limit?: number): Promise<EventDto[]> {
    const now = Date.now();

    const upcoming = store()
      .events.filter((event) => event.eventDate.getTime() >= now)
      .sort(byDateThenCreated);

    return (limit === undefined ? upcoming : upcoming.slice(0, limit)).map(toDto);
  }

  async findById(id: string): Promise<EventDto | null> {
    const event = store().events.find((candidate) => candidate.id === id);
    return event ? toDto(event) : null;
  }

  async listByCreator(creatorId: string): Promise<EventDto[]> {
    return store()
      .events.filter((event) => event.creatorId === creatorId)
      .sort(byDateThenCreated)
      .map(toDto);
  }

  async listJoinedByUser(userId: string): Promise<EventDto[]> {
    const state = store();
    const joinedIds = new Set(
      state.participations
        .filter((row) => row.userId === userId)
        .map((row) => row.eventId),
    );

    return state.events
      .filter((event) => joinedIds.has(event.id))
      .sort(byDateThenCreated)
      .map(toDto);
  }

  async hasJoined(eventId: string, userId: string): Promise<boolean> {
    return store().participations.some(
      (row) => row.eventId === eventId && row.userId === userId,
    );
  }

  async create(input: EventInput, creator: AuthUser): Promise<EventDto> {
    const now = new Date();
    const event: StoredEvent = {
      ...input,
      id: randomUUID(),
      creatorId: creator.id,
      creatorEmail: creator.email,
      creatorName: creator.name,
      creatorImage: creator.image ?? null,
      participantCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    store().events.push(event);

    return toDto(event);
  }

  async update(id: string, patch: EventPatch): Promise<EventDto | null> {
    const event = store().events.find((candidate) => candidate.id === id);
    if (!event) return null;

    Object.assign(event, patch, { updatedAt: new Date() });

    return toDto(event);
  }

  async remove(id: string): Promise<boolean> {
    const state = store();
    const index = state.events.findIndex((event) => event.id === id);
    if (index === -1) return false;

    state.events.splice(index, 1);
    state.participations = state.participations.filter((row) => row.eventId !== id);

    return true;
  }

  async join(eventId: string, user: AuthUser): Promise<boolean> {
    const state = store();
    const event = state.events.find((candidate) => candidate.id === eventId);
    if (!event) return false;

    const alreadyJoined = state.participations.some(
      (row) => row.eventId === eventId && row.userId === user.id,
    );
    if (alreadyJoined) return false;

    state.participations.push({
      eventId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      joinedAt: new Date(),
    });
    event.participantCount += 1;

    return true;
  }

  async leave(eventId: string, userId: string): Promise<boolean> {
    const state = store();
    const before = state.participations.length;

    state.participations = state.participations.filter(
      (row) => !(row.eventId === eventId && row.userId === userId),
    );

    if (state.participations.length === before) return false;

    const event = state.events.find((candidate) => candidate.id === eventId);
    if (event && event.participantCount > 0) event.participantCount -= 1;

    return true;
  }
}
