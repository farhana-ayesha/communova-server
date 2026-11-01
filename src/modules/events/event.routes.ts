import { Router } from "express";
import { currentUser, optionalAuth, requireAuth } from "../../middleware/require-auth.js";
import { HttpError } from "../../utils/http-error.js";
import { parse } from "../../utils/parse.js";
import { createEventSchema, listQuerySchema, updateEventSchema } from "./event.schema.js";
import {
  createEvent,
  deleteEvent,
  getEventView,
  joinEvent,
  leaveEvent,
  listEventsByCreator,
  listJoinedEvents,
  listUpcomingEvents,
  updateEvent,
} from "./event.service.js";

function eventId(request: { params: Record<string, unknown> }): string {
  const value = request.params.id;
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.notFound("That event is not on the register.");
  }

  return value;
}

export const eventsRouter: Router = Router();

/** Public register: upcoming events, nearest first, optionally capped. */
eventsRouter.get("/", async (request, response) => {
  const { limit } = parse(listQuerySchema, request.query);
  const events = await listUpcomingEvents(limit);

  response.json({ data: events, meta: { count: events.length } });
});

/** Private: events created by the signed-in member. */
eventsRouter.get("/mine", requireAuth, async (request, response) => {
  const events = await listEventsByCreator(currentUser(request));
  response.json({ data: events, meta: { count: events.length } });
});

/** Private: events the signed-in member has joined, including past ones. */
eventsRouter.get("/joined", requireAuth, async (request, response) => {
  const events = await listJoinedEvents(currentUser(request));
  response.json({ data: events, meta: { count: events.length } });
});

/** Public detail. A valid token adds the viewer's join state. */
eventsRouter.get("/:id", optionalAuth, async (request, response) => {
  const view = await getEventView(eventId(request), request.authUser);
  response.json({ data: view });
});

eventsRouter.post("/", requireAuth, async (request, response) => {
  const input = parse(createEventSchema, request.body);
  const event = await createEvent(input, currentUser(request));

  response.status(201).json({ data: event });
});

eventsRouter.patch("/:id", requireAuth, async (request, response) => {
  const patch = parse(updateEventSchema, request.body);
  const event = await updateEvent(eventId(request), patch, currentUser(request));

  response.json({ data: event });
});

eventsRouter.delete("/:id", requireAuth, async (request, response) => {
  await deleteEvent(eventId(request), currentUser(request));
  response.status(204).end();
});

eventsRouter.post("/:id/join", requireAuth, async (request, response) => {
  const view = await joinEvent(eventId(request), currentUser(request));
  response.json({ data: view });
});

eventsRouter.delete("/:id/join", requireAuth, async (request, response) => {
  const view = await leaveEvent(eventId(request), currentUser(request));
  response.json({ data: view });
});

