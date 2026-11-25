"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Link2, Loader2, PlayCircle, Trash2, Upload } from "lucide-react";
import {
  DEFAULT_VIDEO_HEADING,
  DEFAULT_VIDEO_TEXT,
  MAX_VIDEOS,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_CAPTION,
  MAX_VIDEO_HEADING,
  MAX_VIDEO_TEXT,
  VIDEO_BUCKET,
  VIDEO_PROVIDERS,
  VIDEO_TYPES,
  parseVideoLink,
  videoFileUrl,
  socialButtonLabel,
  videoThumbnail,
  type SiteVideo,
  type VideoIntro,
} from "@leadgen/core/branding/videos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { Field, SaveForm, type Action } from "../form-kit";
import { Group } from "./general-forms";

// Settings → Booking page → Videos of your work: short videos on the home
// page, uploaded or linked from YouTube, Vimeo, TikTok or Instagram. The first
// is shown big; customers step through the rest. An upload goes straight
// from the browser to storage (too big for a save) and joins the list when
// it's saved.

type Row = { id: string; caption: string } & (
  | { kind: "upload"; path: string; vertical: boolean; preview?: string }
  | { kind: "link"; url: string; video: Extract<SiteVideo, { kind: "link" }> }
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const YT = (id: string) => `https://youtu.be/${id}`;
const linkOf = (v: Extract<SiteVideo, { kind: "link" }>) =>
  v.provider === "youtube"
    ? v.vertical
      ? `https://youtube.com/shorts/${v.id}`
      : YT(v.id)
    : v.provider === "vimeo"
      ? `https://vimeo.com/${v.id}`
      : v.provider === "tiktok"
        ? `https://www.tiktok.com/embed/v2/${v.id}`
        : `https://www.instagram.com/${v.vertical ? "reel" : "p"}/${v.id}/`;

export function VideosForm({
  videos,
  intro,
  action,
  createUpload,
  readOnly,
}: {
  videos: SiteVideo[];
  intro: VideoIntro;
  action: Action;
  // The one-time upload link for a video file (createVideoUploadAction).
  createUpload: (file: { type: string; size: number }) => Promise<{ path: string; token: string } | { message: string }>;
  readOnly: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    videos.map((v) =>
      v.kind === "upload"
        ? { id: crypto.randomUUID(), caption: v.caption ?? "", kind: "upload", path: v.path, vertical: v.vertical }
        : { id: crypto.randomUUID(), caption: v.caption ?? "", kind: "link", url: linkOf(v), video: v },
    ),
  );
  const [link, setLink] = useState("");
  const [social, setSocial] = useState(intro.social_url ?? "");
  const [problem, setProblem] = useState<string>();
  const [uploading, setUploading] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const room = MAX_VIDEOS - rows.length;

  // Adding, moving and removing aren't typing, so the Save button is told.
  useEffect(() => {
    list.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [rows]);

  function addLink() {
    setProblem(undefined);
    const video = parseVideoLink(link);
    if (!video) return setProblem("That isn't a YouTube, Vimeo, TikTok or Instagram video link.");
    setRows((r) => [...r, { id: crypto.randomUUID(), caption: "", kind: "link", url: link.trim(), video: { kind: "link", ...video } }]);
    setLink("");
  }

  async function upload(file: File | undefined) {
    setProblem(undefined);
    if (!file) return;
    if (!VIDEO_TYPES[file.type]) return setProblem("Use an MP4, WebM or MOV video.");
    if (file.size > MAX_VIDEO_BYTES) {
      return setProblem(`That video is over ${MAX_VIDEO_BYTES / 1024 / 1024} MB. Trim it, or put it on YouTube and add the link.`);
    }
    setUploading(file.name);
    try {
      // Upright or landscape, so the page shapes its player to fit.
      const vertical = await isUpright(file);
      const ticket = await createUpload({ type: file.type, size: file.size });
      if ("message" in ticket) return setProblem(ticket.message);
      const { error } = await createClient().storage.from(VIDEO_BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (error) return setProblem("The upload didn't finish. Check your connection and try again.");
      setRows((r) => [...r, { id: crypto.randomUUID(), caption: "", kind: "upload", path: ticket.path, vertical, preview: URL.createObjectURL(file) }]);
    } catch {
      setProblem("The upload didn't finish. Check your connection and try again.");
    } finally {
      setUploading(null);
    }
  }

  const move = (from: number, to: number) =>
    setRows((r) => {
      if (to < 0 || to >= r.length) return r;
      const next = [...r];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <div ref={list} className="grid gap-8">
          <Group title="Words" note="Beside the video on your home page. Blank uses the wording shown greyed out.">
            <Field label="Heading" name="video_heading" error={errors.video_heading}>
              <Input name="video_heading" defaultValue={intro.heading ?? ""} maxLength={MAX_VIDEO_HEADING} placeholder={DEFAULT_VIDEO_HEADING} />
            </Field>
            <Field label="Text" name="video_text" error={errors.video_text}>
              <Textarea name="video_text" rows={2} defaultValue={intro.text ?? ""} maxLength={MAX_VIDEO_TEXT} placeholder={DEFAULT_VIDEO_TEXT} />
            </Field>
            <Field
              label="Your social media page"
              name="social_url"
              error={errors.social_url}
              hint={social.trim() ? `Shows a "${socialButtonLabel(/^https?:\/\//i.test(social.trim()) ? social.trim() : `https://${social.trim()}`)}" button.` : "Optional. Where to see more of your videos, like your Instagram or TikTok. Blank shows no button."}
            >
              <Input
                name="social_url"
                value={social}
                onChange={(e) => setSocial(e.target.value)}
                inputMode="url"
                placeholder="e.g. instagram.com/yourbusiness"
              />
            </Field>
          </Group>

          <Group title="Videos" note="The first is shown first, with arrows to the rest.">
          <div className="grid gap-4">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No videos yet. A short clip of a car going from dirty to gleaming shows what you do better than anything.
              The section only shows on your page once you add one.
            </p>
          ) : (
            <ol className="grid gap-3">
              {rows.map((row, i) => (
                <li key={row.id} className="grid gap-2 rounded-lg border p-2 pr-3">
                  <input type="hidden" name="video" value={row.kind === "upload" ? `upload:${row.vertical ? "v" : "h"}:${row.path}` : `link:${row.url}`} />
                  <div className="flex items-center gap-3">
                    <Preview row={row} />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <p className="truncate text-xs text-muted-foreground">
                        {i === 0 && <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">Shown first</span>}
                        {row.kind === "upload" ? `Uploaded video${row.vertical ? " (upright)" : " (landscape)"}` : `${VIDEO_PROVIDERS[row.video.provider]}${row.video.vertical ? " (upright)" : ""}`}
                      </p>
                      <Input
                        name="video_caption"
                        value={row.caption}
                        onChange={(e) => {
                          const caption = e.target.value;
                          setRows((r) => r.map((x) => (x.id === row.id ? { ...x, caption } : x)));
                        }}
                        maxLength={MAX_VIDEO_CAPTION}
                        placeholder="Caption (optional), e.g. Full valet on a muddy Range Rover"
                        aria-label={`Caption for video ${i + 1}`}
                      />
                    </div>
                    {!readOnly && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move video ${i + 1} up`}>
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={i === rows.length - 1}
                          onClick={() => move(i, i + 1)}
                          aria-label={`Move video ${i + 1} down`}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                          aria-label={`Remove video ${i + 1}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </div>
                  {errors[`video_${i}`] && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors[`video_${i}`]}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {!readOnly && room > 0 && (
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 @lg:grid-cols-[minmax(0,1fr)_auto] @lg:items-end">
              <div className="grid gap-1.5">
                <label htmlFor="video-link" className="text-sm font-medium">
                  Add a link
                </label>
                <div className="flex gap-2">
                  <Input
                    id="video-link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLink();
                      }
                    }}
                    placeholder="YouTube, Vimeo, TikTok or Instagram link"
                    inputMode="url"
                  />
                  <Button type="button" variant="outline" onClick={addLink} disabled={!link.trim()}>
                    <Link2 aria-hidden /> Add
                  </Button>
                </div>
              </div>
              <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium transition hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:pointer-events-none has-disabled:opacity-60">
                {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
                {uploading ? "Uploading…" : "Upload a video"}
                <input
                  type="file"
                  accept={Object.keys(VIDEO_TYPES).join(",")}
                  className="sr-only"
                  disabled={Boolean(uploading)}
                  onChange={(e) => {
                    void upload(e.currentTarget.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          )}
          <p className={problem ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={problem ? "alert" : undefined}>
            {problem ??
              (uploading
                ? `Uploading ${uploading}. Keep this page open.`
                : room === 0
                  ? `That's the most you can show (${MAX_VIDEOS}). Remove one to add another.`
                  : `Up to ${MAX_VIDEOS}. Uploads: MP4, WebM or MOV up to ${MAX_VIDEO_BYTES / 1024 / 1024} MB; short clips work best, upright or landscape.`)}
          </p>
          </div>
          </Group>
        </div>
      )}
    </SaveForm>
  );
}

// Whether a video is taller than wide, read from the file before it goes up.
// Upright if it can't be read: most clips are filmed on a phone.
function isUpright(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (upright: boolean) => {
      URL.revokeObjectURL(url);
      resolve(upright);
    };
    const timer = window.setTimeout(() => done(true), 5000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(!video.videoWidth || video.videoHeight >= video.videoWidth);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done(true);
    };
    video.src = url;
  });
}

// A small look at the video: YouTube's still, the uploaded clip's first
// frame, or a play symbol for the others.
function Preview({ row }: { row: Row }) {
  const still = row.kind === "link" ? videoThumbnail(row.video) : null;
  return (
    <div className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
      {row.kind === "upload" ? (
        <video src={row.preview ?? `${videoFileUrl(SUPABASE_URL, row.path)}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="" className="size-full object-cover" />
      ) : (
        <PlayCircle className="size-6" aria-hidden />
      )}
    </div>
  );
}
