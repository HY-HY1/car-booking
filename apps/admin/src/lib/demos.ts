// Demo videos for the marketing pages. Paste a video's embed address into
// `embedUrl` to show it: YouTube (https://www.youtube-nocookie.com/embed/ID),
// Vimeo (https://player.vimeo.com/video/ID) or Loom
// (https://www.loom.com/embed/ID). Until then each slot offers a live demo
// instead, and in development it's marked as a placeholder.

export type Demo = {
  title: string;
  // Shown on the frame, e.g. "3 min".
  length: string;
  summary: string;
  embedUrl: string | null;
};

export const DEMOS = {
  tour: {
    title: "The whole thing, start to finish",
    length: "3 min",
    summary: "A customer books and pays, then the job lands in the diary, the route planner and the payments.",
    embedUrl: null,
  },
  booking: {
    title: "Booking as a customer",
    length: "1 min",
    summary: "Price a car, add photos, pick a time and pay the deposit, on a phone.",
    embedUrl: null,
  },
  day: {
    title: "Running your day",
    length: "1 min",
    summary: "The diary by van, the route planner's leave-by times and one tap to navigate.",
    embedUrl: null,
  },
  paid: {
    title: "Getting paid",
    length: "1 min",
    summary: "Deposits, refunds by your policy, and emailing a payment link for the balance.",
    embedUrl: null,
  },
} satisfies Record<string, Demo>;

const EMBED_HOSTS = ["www.youtube-nocookie.com", "www.youtube.com", "player.vimeo.com", "www.loom.com"];

// Only https embeds from the hosts above are drawn.
export function safeEmbedUrl(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && EMBED_HOSTS.includes(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}
