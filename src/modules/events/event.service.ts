import { HttpError } from "../../utils/http-error.js";
import { env } from "../../config/env.js";
import { MongoEventsRepository } from "./event.repository.js";
import { MemoryEventsRepository } from "./event.memory.js";
import type {
  AuthUser,
  EventDto,
  EventInput,
  EventPatch,
  EventsRepository,
  EventView,
} from "./event.types.js";

let repository: EventsRepository | undefined;

/**
 * Production reads and writes go to MongoDB. The memory repository exists only
 * for local development and is refused in production by `index.ts` and the
 * environment schema.
 */
export function getEventsRepository(): EventsRepository {
  if (!repository) {
    repository = env.eventsDevMemory
      ? new MemoryEventsRepository()
      : new MongoEventsRepository();
  }

  return repository;
}

function assertFuture(date: Date, message = "Choose a date in the future.") {
  if (date.getTime() <= Date.now()) {
    throw HttpError.unprocessable(message, {
      fieldErrors: { eventDate: [message] },
    });
  }
}

/** `datetime-local` has minute precision, so unchanged dates compare by minute. */
function sameMinute(a: Date, b: Date): boolean {
  return Math.floor(a.getTime() / 60_000) === Math.floor(b.getTime() / 60_000);
}

function assertPastEventCanKeepDate(existing: EventDto, patchDate: Date): void {
  const existingDate = new Date(existing.eventDate);
  const alreadyHappened = existingDate.getTime() <= Date.now();

  if (!alreadyHappened) {
    assertFuture(patchDate);
    return;
  }

  if (!sameMinute(existingDate, patchDate)) {
    const message = "A past event cannot be moved to a new date.";
    throw HttpError.unprocessable(
      "Past events keep their original date. You can still edit the other details.",
      {
        fieldErrors: { eventDate: [message] },
      },
    );
  }
}

export async function listUpcomingEvents(limit?: number): Promise<EventDto[]> {
  return getEventsRepository().listUpcoming(limit);
}

export async function getEventView(
  id: string,
  viewer?: AuthUser,
): Promise<EventView> {
  const event = await getEventsRepository().findById(id);
  if (!event) throw HttpError.notFound("That event is not on the register.");

  const viewerHasJoined = viewer
    ? await getEventsRepository().hasJoined(id, viewer.id)
    : false;

  return { event, viewerHasJoined };
}

export async function createEvent(
  input: EventInput,
  creator: AuthUser,
): Promise<EventDto> {
  assertFuture(input.eventDate);

  return getEventsRepository().create(input, creator);
}

export async function updateEvent(
  id: string,
  patch: EventPatch,
  user: AuthUser,
): Promise<EventDto> {
  const existing = await getEventsRepository().findById(id);
  if (!existing) throw HttpError.notFound("That event is not on the register.");

  if (existing.creator.id !== user.id) {
    throw HttpError.forbidden("Only the member who created this event can edit it.");
  }

  if (patch.eventDate) assertPastEventCanKeepDate(existing, patch.eventDate);

  const updated = await getEventsRepository().update(id, patch);
  if (!updated) throw HttpError.notFound("That event is not on the register.");

  return updated;
}

export async function deleteEvent(id: string, user: AuthUser): Promise<void> {
  const existing = await getEventsRepository().findById(id);
  if (!existing) throw HttpError.notFound("That event is not on the register.");

  if (existing.creator.id !== user.id) {
    throw HttpError.forbidden("Only the member who created this event can delete it.");
  }

  await getEventsRepository().remove(id);
}

export async function listEventsByCreator(user: AuthUser): Promise<EventDto[]> {
  return getEventsRepository().listByCreator(user.id);
}

export async function listJoinedEvents(user: AuthUser): Promise<EventDto[]> {
  return getEventsRepository().listJoinedByUser(user.id);
}

export async function joinEvent(id: string, user: AuthUser): Promise<EventView> {
  const event = await getEventsRepository().findById(id);
  if (!event) throw HttpError.notFound("That event is not on the register.");

  if (new Date(event.eventDate).getTime() <= Date.now()) {
    throw HttpError.conflict("This event has already happened.");
  }

  await getEventsRepository().join(id, user);

  return getEventView(id, user);
}

export async function leaveEvent(id: string, user: AuthUser): Promise<EventView> {
  const event = await getEventsRepository().findById(id);
  if (!event) throw HttpError.notFound("That event is not on the register.");

  if (new Date(event.eventDate).getTime() <= Date.now()) {
    throw HttpError.conflict("This event has already happened.");
  }

  await getEventsRepository().leave(id, user.id);

  return getEventView(id, user);
}
