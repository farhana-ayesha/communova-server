import type { AuthUser, EventInput } from "./event.types.js";

export interface SeedEvent {
  input: EventInput;
  creator: AuthUser;
  participantCount: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** 09:00 in Dhaka (UTC+6), which is 03:00 UTC. */
function morningInDhaka(daysAhead: number, base = Date.now()): Date {
  const date = new Date(base + daysAhead * DAY);
  date.setUTCHours(3, 0, 0, 0);
  return date;
}

/**
 * Development-only sample register. Real deployments start empty and fill up
 * through the create-event form; this exists so the homepage and list pages can
 * be designed and reviewed without a reachable mongod.
 */
export function buildSeedEvents(now = Date.now()): SeedEvent[] {
  const rafiq: AuthUser = {
    id: "seed-rafiq",
    name: "Rafiq Hasan",
    email: "rafiq.hasan@communova.dev",
  };
  const tanvir: AuthUser = {
    id: "seed-tanvir",
    name: "Tanvir Ahmed",
    email: "tanvir.ahmed@communova.dev",
  };
  const sabbir: AuthUser = {
    id: "seed-sabbir",
    name: "Sabbir Rahman",
    email: "sabbir.rahman@communova.dev",
  };
  const imran: AuthUser = {
    id: "seed-imran",
    name: "Imran Chowdhury",
    email: "imran.chowdhury@communova.dev",
  };

  const images = {
    clothes:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80",
    blankets:
      "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1200&q=80",
    bins:
      "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80",
    seedling:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
    garden:
      "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=1200&q=80",
    stethoscope:
      "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=1200&q=80",
    books:
      "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80",
  } as const;

  return [
    {
      input: {
        title: "Winter Clothes Distribution — Mirpur 10",
        description:
          "We are sorting and handing out warm jackets, sweaters, and blankets to families in Mirpur 10. Bring one clean winter item if you can, or come and help with the queue and the packing.",
        type: "donation",
        thumbnailUrl: images.clothes,
        location: "Mirpur 10 Roundabout, Dhaka",
        eventDate: morningInDhaka(5, now),
      },
      creator: rafiq,
      participantCount: 18,
    },
    {
      input: {
        title: "Blanket Distribution for the Needy",
        description:
          "A morning distribution of blankets in Mohammadpur, working with the local ward office. Volunteers are needed to carry, sort, and record each household that receives one.",
        type: "donation",
        thumbnailUrl: images.blankets,
        location: "Mohammadpur Bus Stand, Dhaka",
        eventDate: morningInDhaka(8, now),
      },
      creator: tanvir,
      participantCount: 12,
    },
    {
      input: {
        title: "Buriganga Bank Cleanup",
        description:
          "A two-hour cleanup along the Buriganga foreshore at Sadarghat. Gloves, sacks, and drinking water are provided; wear closed shoes and bring a cap.",
        type: "cleanup",
        thumbnailUrl: images.bins,
        location: "Sadarghat Launch Terminal, Dhaka",
        eventDate: morningInDhaka(11, now),
      },
      creator: sabbir,
      participantCount: 26,
    },
    {
      input: {
        title: "Plantation Morning at Dhanmondi Lake",
        description:
          "We are planting native shade trees along the eastern walk of Dhanmondi Lake with the park caretakers. Come with a water bottle; saplings and tools are on site.",
        type: "plantation",
        thumbnailUrl: images.seedling,
        location: "Dhanmondi Lake, Road 27 entrance",
        eventDate: morningInDhaka(15, now),
      },
      creator: rafiq,
      participantCount: 31,
    },
    {
      input: {
        title: "Free Health Camp — Korail",
        description:
          "A free check-up morning for residents of Korail, run with volunteer physicians. We need help with registration, crowd flow, and distributing medicine slips.",
        type: "health",
        thumbnailUrl: images.stethoscope,
        location: "Korail Community Centre, Mohakhali",
        eventDate: morningInDhaka(22, now),
      },
      creator: imran,
      participantCount: 9,
    },
    {
      input: {
        title: "School Kit Assembly — Uttara",
        description:
          "Packing 300 school kits: notebooks, pencils, a sharpener, and a cloth bag. We will assemble, count, and label them for delivery to two government primary schools.",
        type: "education",
        thumbnailUrl: images.books,
        location: "Uttara Sector 7 Community Hall, Dhaka",
        eventDate: morningInDhaka(29, now),
      },
      creator: tanvir,
      participantCount: 14,
    },
    {
      input: {
        title: "Ramna Park Weekend Cleanup",
        description:
          "A family-friendly cleanup of the walking paths and the lake edge at Ramna Park. Bags and pickers are supplied; the park office will take the collected waste.",
        type: "cleanup",
        thumbnailUrl: images.garden,
        location: "Ramna Park, Minto Road gate",
        eventDate: morningInDhaka(36, now),
      },
      creator: sabbir,
      participantCount: 22,
    },
    {
      input: {
        title: "Winter Blanket Collection — Lalmatia",
        description:
          "A collection point for clean blankets and warm clothes ahead of the cold spell. Volunteers help receive, sort, and bundle donations for the Mohammadpur distribution.",
        type: "donation",
        thumbnailUrl: images.blankets,
        location: "Lalmatia Block C, Dhaka",
        eventDate: morningInDhaka(43, now),
      },
      creator: imran,
      participantCount: 7,
    },
  ];
}
