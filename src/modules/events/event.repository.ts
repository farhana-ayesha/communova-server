import { ObjectId, type Collection, type Db } from "mongodb";
import { getMongoDb } from "../../db/mongo.js";
import {
  COLLECTIONS,
  toEventDto,
  type AuthUser,
  type EventDocument,
  type EventDto,
  type EventInput,
  type EventPatch,
  type EventsRepository,
  type ParticipationDocument,
} from "./event.types.js";

/** Only 24-character hex strings are accepted, so `/events/hello` is a 404. */
function toObjectId(id: string): ObjectId | null {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  return new ObjectId(id);
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export class MongoEventsRepository implements EventsRepository {
  private readonly db: Db;

  constructor(db: Db = getMongoDb()) {
    this.db = db;
  }

  private get events(): Collection<EventDocument> {
    return this.db.collection<EventDocument>(COLLECTIONS.events);
  }

  private get participations() {
    return this.db.collection<ParticipationDocument>(COLLECTIONS.participations);
  }

  async listUpcoming(limit?: number): Promise<EventDto[]> {
    // `.limit()` here backs the homepage's six most recent upcoming events.
    let cursor = this.events
      .find({ eventDate: { $gte: new Date() } })
      .sort({ eventDate: 1, createdAt: 1 });

    if (limit !== undefined) cursor = cursor.limit(limit);

    const documents = await cursor.toArray();
    return documents.map((document) => toEventDto(document));
  }

  async findById(id: string): Promise<EventDto | null> {
    const objectId = toObjectId(id);
    if (!objectId) return null;

    const document = await this.events.findOne({ _id: objectId });
    return document ? toEventDto(document) : null;
  }

  async listByCreator(creatorId: string): Promise<EventDto[]> {
    const documents = await this.events
      .find({ creatorId })
      .sort({ eventDate: 1, createdAt: 1 })
      .toArray();

    return documents.map((document) => toEventDto(document));
  }

  async listJoinedByUser(userId: string): Promise<EventDto[]> {
    const rows = await this.participations.find({ userId }).toArray();
    if (rows.length === 0) return [];

    const documents = await this.events
      .find({ _id: { $in: rows.map((row) => row.eventId) } })
      .sort({ eventDate: 1 })
      .toArray();

    return documents.map((document) => toEventDto(document));
  }

  async hasJoined(eventId: string, userId: string): Promise<boolean> {
    const objectId = toObjectId(eventId);
    if (!objectId) return false;

    const row = await this.participations.findOne(
      { eventId: objectId, userId },
      { projection: { _id: 1 } },
    );

    return Boolean(row);
  }

  async create(input: EventInput, creator: AuthUser): Promise<EventDto> {
    const now = new Date();

    const document = {
      _id: new ObjectId(),
      ...input,
      creatorId: creator.id,
      creatorEmail: creator.email,
      creatorName: creator.name,
      participantCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.events.insertOne(document);

    return toEventDto(document);
  }

  async update(id: string, patch: EventPatch): Promise<EventDto | null> {
    const objectId = toObjectId(id);
    if (!objectId) return null;

    const document = await this.events.findOneAndUpdate(
      { _id: objectId },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    return document ? toEventDto(document) : null;
  }

  async remove(id: string): Promise<boolean> {
    const objectId = toObjectId(id);
    if (!objectId) return false;

    const result = await this.events.deleteOne({ _id: objectId });
    await this.participations.deleteMany({ eventId: objectId });

    return result.deletedCount === 1;
  }

  async join(eventId: string, user: AuthUser): Promise<boolean> {
    const objectId = toObjectId(eventId);
    if (!objectId) return false;

    try {
      await this.participations.insertOne({
        _id: new ObjectId(),
        eventId: objectId,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        joinedAt: new Date(),
      });
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }

    await this.events.updateOne({ _id: objectId }, { $inc: { participantCount: 1 } });

    return true;
  }

  async leave(eventId: string, userId: string): Promise<boolean> {
    const objectId = toObjectId(eventId);
    if (!objectId) return false;

    const result = await this.participations.deleteOne({
      eventId: objectId,
      userId,
    });

    if (result.deletedCount === 0) return false;

    await this.events.updateOne(
      { _id: objectId, participantCount: { $gt: 0 } },
      { $inc: { participantCount: -1 } },
    );

    return true;
  }
}

/**
 * Indexes are idempotent, so this is safe to call on every cold start.
 * The unique pair is what makes joining twice a no-op rather than a duplicate.
 */
export async function ensureEventIndexes(db: Db = getMongoDb()): Promise<void> {
  await Promise.all([
    db
      .collection(COLLECTIONS.events)
      .createIndex({ eventDate: 1, createdAt: 1 }),
    db.collection(COLLECTIONS.events).createIndex({ creatorId: 1 }),
    db
      .collection(COLLECTIONS.participations)
      .createIndex({ eventId: 1, userId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.participations).createIndex({ userId: 1 }),
  ]);
}
