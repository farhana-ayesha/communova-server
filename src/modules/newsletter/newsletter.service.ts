import { env } from "../../config/env.js";
import { MemoryNewsletterRepository } from "./newsletter.memory.js";
import { MongoNewsletterRepository } from "./newsletter.repository.js";
import type {
  NewsletterRepository,
  NewsletterSubscription,
} from "./newsletter.types.js";

let repository: NewsletterRepository | undefined;

export function getNewsletterRepository(): NewsletterRepository {
  if (!repository) {
    repository = env.eventsDevMemory
      ? new MemoryNewsletterRepository()
      : new MongoNewsletterRepository();
  }

  return repository;
}

export async function subscribeToNewsletter(
  email: string,
): Promise<NewsletterSubscription> {
  const created = await getNewsletterRepository().subscribe(email, "website");

  return { email, alreadySubscribed: !created };
}
