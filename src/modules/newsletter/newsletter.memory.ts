import type { NewsletterRepository } from "./newsletter.types.js";

interface MemorySubscriber {
  email: string;
  source: string;
  createdAt: Date;
}

const globalForNewsletter = globalThis as typeof globalThis & {
  __communovaNewsletterMemory?: Map<string, MemorySubscriber>;
};

function subscribers(): Map<string, MemorySubscriber> {
  globalForNewsletter.__communovaNewsletterMemory ??= new Map();
  return globalForNewsletter.__communovaNewsletterMemory;
}

/**
 * Process-local mirror used only with `EVENTS_DEV_MEMORY=1`. It preserves the
 * same idempotent semantics as the Mongo repository.
 */
export class MemoryNewsletterRepository implements NewsletterRepository {
  async subscribe(email: string, source: string): Promise<boolean> {
    const store = subscribers();
    if (store.has(email)) return false;

    store.set(email, { email, source, createdAt: new Date() });
    return true;
  }
}
