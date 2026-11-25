"use client";

import { useState } from "react";
import {
  DESCRIPTION_SHOWN,
  MAX_SEO_DESCRIPTION,
  MAX_SEO_TITLE,
  TITLE_SHOWN,
  type SeoSettings,
} from "@leadgen/core/branding/seo";
import { CopyText } from "@/components/platform/copy-text";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Field, SaveForm, type Action } from "../form-kit";
import { Group, ImageField } from "./general-forms";
import { IconField } from "./icon-field";

// Settings → Booking page → Search and sharing: how the booking site looks in
// Google and when its link is shared, its tab icon, Search Console, and
// whether search engines may list it. Everything defaults to something made
// from the business's own details, shown as the placeholder.

export function SeoForm({
  seo,
  defaults,
  siteUrl,
  sitemapUrl,
  autoIconUrl,
  coverUrl,
  action,
  readOnly,
}: {
  seo: SeoSettings;
  // The title and description made from the business's details.
  defaults: { title: string; description: string };
  // The home page's address, as search engines see it.
  siteUrl: string;
  sitemapUrl: string;
  // The icon made from the logo or initial, for when none is uploaded.
  autoIconUrl: string;
  coverUrl?: string;
  action: Action;
  readOnly: boolean;
}) {
  const [title, setTitle] = useState(seo.title ?? "");
  const [description, setDescription] = useState(seo.description ?? "");
  const [hidden, setHidden] = useState(seo.hidden);
  // Bumped after a save so the image pickers start empty again.
  const [generation, setGeneration] = useState(0);
  const shownTitle = title.trim() || defaults.title;
  const shownDescription = description.trim() || defaults.description;

  return (
    <SaveForm action={action} readOnly={readOnly} onSaved={() => setGeneration((g) => g + 1)}>
      {(errors) => (
        <div className="grid gap-8">
          <Group title="In Google" note="The title and description under your link in search results. Blank uses the ones made from your details, shown greyed out.">
            <Field
              label={<Counted label="Title" length={shownTitle.length} shown={TITLE_SHOWN} />}
              name="seo_title"
              error={errors.seo_title}
              hint="Say what you do and where, like the example. Your name is added to every other page's title."
            >
              <Input name="seo_title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_SEO_TITLE} placeholder={defaults.title} />
            </Field>
            <Field
              label={<Counted label="Description" length={shownDescription.length} shown={DESCRIPTION_SHOWN} />}
              name="seo_description"
              error={errors.seo_description}
              hint="A sentence or two that makes someone pick you: the area, what's special, and that they can book online."
            >
              <Textarea
                name="seo_description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={MAX_SEO_DESCRIPTION}
                placeholder={defaults.description}
              />
            </Field>
            <GooglePreview url={siteUrl} title={shownTitle} description={shownDescription} />
          </Group>

          <Group title="When your link is shared" note="On WhatsApp, Facebook, text messages and the like. JPG, PNG or WebP.">
            <ImageField
              key={`share-${generation}`}
              label="Sharing picture"
              name="share_image"
              current={seo.share_image_url}
              error={errors.share_image}
              hint={coverUrl ? "Optional. Wide works best (about 1200 × 630). Blank uses your cover image." : "Optional. Wide works best (about 1200 × 630)."}
              maxEdge={1600}
              wide
            />
          </Group>

          <Group
            title="Browser tab icon"
            note="The little picture on the browser tab and on a phone's home screen. Without one, it's made from your logo if that's square enough, or your initial on your main colour."
          >
            <IconField key={`icon-${generation}`} name="tab_icon" current={seo.icon_url} autoUrl={autoIconUrl} error={errors.tab_icon} disabled={readOnly} />
          </Group>

          <Group title="Google Search Console" note="Optional. Shows how people find you on Google, and lets you ask Google to look at your site.">
            <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
              <li>In Search Console, add a property and choose URL prefix, with the address below.</li>
              <li>Choose the HTML tag way to verify, and paste the tag it gives you here. Save, then press Verify there.</li>
              <li>Under Sitemaps, add the sitemap address below.</li>
            </ol>
            <div className="grid gap-3 @lg:grid-cols-2">
              <div className="grid gap-1.5">
                <p className="text-sm font-medium">Your address</p>
                <CopyText value={siteUrl} label="booking page address" />
              </div>
              <div className="grid gap-1.5">
                <p className="text-sm font-medium">Your sitemap</p>
                <CopyText value={sitemapUrl} label="sitemap address" />
              </div>
            </div>
            <Field label="Verification tag" name="google_verification" error={errors.google_verification}>
              <Input
                name="google_verification"
                defaultValue={seo.google_verification ? `<meta name="google-site-verification" content="${seo.google_verification}" />` : ""}
                placeholder={`<meta name="google-site-verification" content="…" />`}
                className="font-mono text-xs"
                autoComplete="off"
              />
            </Field>
          </Group>

          <div className="grid gap-3 rounded-lg border p-4">
            <Switch
              name="hidden"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
              description="While you're setting up, or if customers only book through your own website. Your pages still work for anyone with the link."
            >
              Hide from search engines
            </Switch>
            {hidden && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Search engines are asked not to list any page. It can take Google a few weeks to drop pages it has already listed.
              </p>
            )}
          </div>
        </div>
      )}
    </SaveForm>
  );
}

// "Title 54 / 60": the count turns amber once Google would cut it off.
function Counted({ label, length, shown }: { label: string; length: number; shown: number }) {
  return (
    <span className="flex w-full items-baseline justify-between gap-3">
      {label}
      <span className={cn("text-xs font-normal tabular-nums", length > shown ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        {length} / {shown}
      </span>
    </span>
  );
}

// Roughly how the home page looks in Google's results.
function GooglePreview({ url, title, description }: { url: string; title: string; description: string }) {
  const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
  const address = url.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/").join(" › ");
  return (
    <figure className="grid gap-1.5">
      <figcaption className="text-xs font-medium text-muted-foreground">How it may look in Google</figcaption>
      <div className="grid gap-0.5 rounded-lg border bg-white p-4 font-[arial,sans-serif] text-[#202124]">
        <p className="truncate text-xs text-[#4d5156]">{address}</p>
        <p className="truncate text-lg leading-snug text-[#1a0dab]">{cut(title, TITLE_SHOWN)}</p>
        <p className="line-clamp-2 text-sm leading-snug text-[#4d5156]">{cut(description, DESCRIPTION_SHOWN)}</p>
      </div>
    </figure>
  );
}
