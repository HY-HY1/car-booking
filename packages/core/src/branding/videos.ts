import { z } from "zod";

// Short videos of a business's work on its booking page's home (Settings →
// Booking page → Videos of your work): ones the owner uploaded, or links to
// YouTube (Shorts too), Vimeo, TikTok or Instagram. Kept in
// tenants.branding.videos, so no migration; the uploads live in the
// site-videos bucket (migration 20261125140000). Pure, so it can be tested.

export const MAX_VIDEOS = 6;
export const MAX_VIDEO_CAPTION = 100;
export const VIDEO_BUCKET = "site-videos";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

export const VIDEO_PROVIDERS = { youtube: "YouTube", vimeo: "Vimeo", tiktok: "TikTok", instagram: "Instagram" } as const;
export type VideoProvider = keyof typeof VIDEO_PROVIDERS;

export type SiteVideo =
  // `vertical`: taller than wide, as most phone clips are; worked out from the
  // file when it's uploaded.
  | { kind: "upload"; path: string; vertical: boolean; caption?: string }
  // `vertical`: a Short, TikTok or Reel, shown upright.
  | { kind: "link"; provider: VideoProvider; id: string; vertical: boolean; caption?: string };

// A link as someone pastes it → which video it is, or null if it isn't one
// we can play. The id is only ever letters, numbers, - and _, so it's safe in
// the player's address.
export function parseVideoLink(input: string): { provider: VideoProvider; id: string; vertical: boolean } | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  const path = url.pathname.split("/").filter(Boolean);
  const safe = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{3,64}$/.test(id) ? id : null);

  if (host === "youtu.be") {
    const id = safe(path[0]);
    return id ? { provider: "youtube", id, vertical: false } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (path[0] === "watch") {
      const id = safe(url.searchParams.get("v"));
      return id ? { provider: "youtube", id, vertical: false } : null;
    }
    if (["shorts", "embed", "live", "v"].includes(path[0])) {
      const id = safe(path[1]);
      return id ? { provider: "youtube", id, vertical: path[0] === "shorts" } : null;
    }
    return null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = path.find((p) => /^\d{5,12}$/.test(p));
    return id ? { provider: "vimeo", id, vertical: false } : null;
  }
  if (host === "tiktok.com") {
    const i = path.indexOf("video");
    const id = i >= 0 ? path[i + 1] : path[0] === "embed" ? path[path.length - 1] : null;
    return id && /^\d{8,25}$/.test(id) ? { provider: "tiktok", id, vertical: true } : null;
  }
  if (host === "instagram.com") {
    const i = path.findIndex((p) => p === "reel" || p === "reels" || p === "p");
    const id = i >= 0 ? safe(path[i + 1]) : null;
    return id ? { provider: "instagram", id, vertical: path[i] !== "p" } : null;
  }
  return null;
}

// The player to show once someone presses play. YouTube's no-cookie address
// and Vimeo's do-not-track keep tracking down; nothing loads until then.
export function embedUrl(video: Extract<SiteVideo, { kind: "link" }>) {
  switch (video.provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`;
    case "vimeo":
      return `https://player.vimeo.com/video/${video.id}?autoplay=1&dnt=1`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${video.id}`;
    case "instagram":
      return `https://www.instagram.com/${video.vertical ? "reel" : "p"}/${video.id}/embed`;
  }
}

// A still to show before play, where the platform offers one without a script.
export function videoThumbnail(video: SiteVideo) {
  return video.kind === "link" && video.provider === "youtube" ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null;
}

// Where an uploaded video is played from.
export function videoFileUrl(supabaseUrl: string, path: string) {
  return `${supabaseUrl}/storage/v1/object/public/${VIDEO_BUCKET}/${path}`;
}

// An upload's path, as the dashboard makes them: <tenant>/videos/<uuid>.<ext>.
export function isVideoPath(path: string, tenantId: string) {
  return new RegExp(`^${tenantId}/videos/[0-9a-f-]{36}\\.(mp4|webm|mov)$`).test(path);
}

const caption = z.string().trim().min(1).max(MAX_VIDEO_CAPTION).optional().catch(undefined);
const videoSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("upload"),
    path: z.string().regex(/^[0-9a-f-]{36}\/videos\/[0-9a-f-]{36}\.(mp4|webm|mov)$/),
    // Upright unless known otherwise: most people film on a phone.
    vertical: z.boolean().catch(true),
    caption,
  }),
  z.object({
    kind: z.literal("link"),
    provider: z.enum(Object.keys(VIDEO_PROVIDERS) as [VideoProvider, ...VideoProvider[]]),
    id: z.string().regex(/^[A-Za-z0-9_-]{3,64}$/),
    vertical: z.boolean().catch(false),
    caption,
  }),
]);

// One broken video is dropped, not the rest.
export const videosSchema = z
  .array(z.unknown())
  .catch([])
  .transform((items): SiteVideo[] =>
    items
      .flatMap((item) => {
        const parsed = videoSchema.safeParse(item);
        if (!parsed.success) return [];
        const v = parsed.data;
        return [v.caption ? v : (({ caption: _c, ...rest }) => rest)(v)] as SiteVideo[];
      })
      .slice(0, MAX_VIDEOS),
  );

// The form: a row per video, in order, each "upload:<v|h>:<path>" (upright
// or landscape) or "link:<url>", with its caption at the same place. An upload is only kept if it's in this
// business's folder; a link only if it's one we can play.
export function parseVideosForm(
  rows: readonly string[],
  captions: readonly string[],
  tenantId: string,
): { videos: SiteVideo[]; errors?: undefined } | { videos?: undefined; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const videos: SiteVideo[] = [];
  rows.forEach((row, i) => {
    const text = (captions[i] ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_VIDEO_CAPTION).trim();
    const withCaption = <T extends object>(v: T) => (text ? { ...v, caption: text } : v);
    if (row.startsWith("upload:")) {
      const shape = /^upload:([vh]):/.exec(row)?.[1];
      const path = shape ? row.slice(9) : row.slice(7);
      if (!isVideoPath(path, tenantId)) errors[`video_${i}`] = "That video can't be used. Upload it again.";
      else videos.push(withCaption({ kind: "upload" as const, path, vertical: shape !== "h" }));
    } else if (row.startsWith("link:")) {
      const link = parseVideoLink(row.slice(5));
      if (!link) errors[`video_${i}`] = "That link isn't a YouTube, Vimeo, TikTok or Instagram video.";
      else videos.push(withCaption({ kind: "link" as const, ...link }));
    }
  });
  if (videos.length > MAX_VIDEOS) errors.videos = `Up to ${MAX_VIDEOS} videos.`;
  return Object.keys(errors).length ? { errors } : { videos };
}

// The uploads a list uses: what a save keeps, and what it leaves to delete.
export function uploadedPaths(videos: readonly SiteVideo[]) {
  return videos.flatMap((v) => (v.kind === "upload" ? [v.path] : []));
}

// ------------------------------------------------- the section's words

export const MAX_VIDEO_HEADING = 60;
export const MAX_VIDEO_TEXT = 300;
export const DEFAULT_VIDEO_HEADING = "See us at work";
export const DEFAULT_VIDEO_TEXT = "Take a look at our work: short clips from real jobs, from the first rinse to the final shine.";

export type VideoIntro = {
  heading?: string;
  text?: string;
  // Where "See more" goes: the business's Instagram, TikTok, YouTube or
  // Facebook page, say. No link, no button.
  social_url?: string;
};

const httpsUrl = z
  .string()
  .trim()
  .refine((v) => /^https:\/\//i.test(v) && URL.canParse(v));

export const videoIntroSchema = z
  .object({
    heading: z.string().trim().min(1).max(MAX_VIDEO_HEADING).optional().catch(undefined),
    text: z.string().trim().min(1).max(MAX_VIDEO_TEXT).optional().catch(undefined),
    social_url: httpsUrl.optional().catch(undefined),
  })
  .catch({});

const SOCIAL: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(facebook\.com|fb\.com)$/, "Facebook"],
  [/(^|\.)(x\.com|twitter\.com)$/, "X"],
  [/(^|\.)vimeo\.com$/, "Vimeo"],
];

// "See more on Instagram", or plainly for a site we don't name.
export function socialButtonLabel(url: string) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "See more of our work";
  }
  const name = SOCIAL.find(([pattern]) => pattern.test(host))?.[1];
  return name ? `See more on ${name}` : "See more of our work";
}

// The settings form's words and link. A link is made https and must be a
// real address; blanks are left out (the defaults show).
export function parseVideoIntro(input: { heading: string; text: string; social: string }):
  | { intro: VideoIntro; errors?: undefined }
  | { intro?: undefined; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const heading = input.heading.trim().replace(/\s+/g, " ");
  const text = input.text.trim().replace(/\s+/g, " ");
  let social = input.social.trim();
  if (heading.length > MAX_VIDEO_HEADING) errors.video_heading = `Keep the heading under ${MAX_VIDEO_HEADING} characters.`;
  if (text.length > MAX_VIDEO_TEXT) errors.video_text = `Keep the text under ${MAX_VIDEO_TEXT} characters.`;
  if (social) {
    if (!/^https?:\/\//i.test(social)) social = `https://${social}`;
    social = social.replace(/^http:\/\//i, "https://");
    if (!URL.canParse(social) || !new URL(social).hostname.includes(".")) errors.social_url = "Enter the full address of the page, like instagram.com/yourbusiness.";
  }
  if (Object.keys(errors).length) return { errors };
  return { intro: { ...(heading && { heading }), ...(text && { text }), ...(social && { social_url: social }) } };
}
