"use server";

import { refresh } from "next/cache";
import { logActivity } from "@/lib/activity";
import { redirect } from "next/navigation";
import { z } from "zod";
import { emailLogoOf } from "@leadgen/core/branding/email-brand";
import { emailLogoFromUrl, makeEmailLogo } from "@leadgen/core/branding/email-logo";
import { customHostnameSchema } from "@leadgen/core/settings/domains";
import { addCustomDomain, checkCustomDomain, makePrimaryDomain, removeCustomDomain } from "@leadgen/core/settings/domains-server";
import { aboutSchema, galleryRows, gallerySchema, type GalleryPhoto } from "@leadgen/core/branding/about";
import { parseFaqForm } from "@leadgen/core/branding/faq";
import { aboutFormSchema, brandingFormSchema, extrasFormSchema, generalFormSchema, homeFormSchema, seoFormSchema } from "@leadgen/core/settings/forms";
import { seoSchema } from "@leadgen/core/branding/seo";
import { MAX_VIDEO_BYTES, VIDEO_BUCKET, VIDEO_TYPES, parseVideoIntro, parseVideosForm, uploadedPaths, videosSchema } from "@leadgen/core/branding/videos";
import { makeTabIcon } from "@leadgen/core/branding/tab-icon";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { SERVICE_IMAGE_MAX_BYTES, SERVICE_IMAGE_TYPES, serviceImageUrl } from "@/lib/pricing-fields";
import { IMAGE_BUCKET, PUBLIC_PREFIX, imageFile, imageProblem, removeBrandImages, uploadBrandBytes, uploadBrandImage } from "@/lib/brand-images";
import { stripeOnboardingUrl } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { failed, fieldErrors, plain, requireOwner } from "./shared";

// "Connect Stripe" / "Continue setup": on to Stripe's hosted onboarding.
export async function connectStripeAction(slug: string) {
  redirect(await stripeOnboardingUrl(slug));
}

// ------------------------------------------------------------------ General

// Business name, contact details, what they do, time zone and VAT. Owners
// and managers (settings.edit); RLS lets the same people write.
export async function saveGeneralAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = generalFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update(parsed.data.tenant).eq("id", tenant.id);
  if (error) return failed("your business details", error);
  // The time zone lives with the booking rules, which read it.
  const tz = await supabase
    .from("booking_settings")
    .update({ timezone: parsed.data.timezone })
    .eq("tenant_id", tenant.id)
    .select("tenant_id");
  if (tz.error) return failed("the time zone", tz.error);
  // No booking rules yet: the rest is saved, but the time zone has nowhere to go.
  if (!tz.data?.length) return { message: "Saved, apart from the time zone: set up booking first, then choose it." };
  await logActivity(tenant.id, "settings.business", "Changed the business details");
  refresh();
  return { saved: true };
}

// ------------------------------------------------------------ Booking page

// Colours, logos (normal and dark mode), cover image, words, website link and the website button.
// Logo and cover go in the public service-images bucket, under the
// business's own folder (only its owners can write there).
export async function saveBrandingAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = brandingFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const files = { logo: imageFile(formData, "logo"), logo_dark: imageFile(formData, "logo_dark"), cover: imageFile(formData, "cover") };
  for (const [name, file] of Object.entries(files)) {
    if (!file) continue;
    if (!SERVICE_IMAGE_TYPES[file.type]) return { errors: { [name]: "Use a JPG, PNG or WebP image." } };
    if (file.size > SERVICE_IMAGE_MAX_BYTES) return { errors: { [name]: "Images can be up to 5 MB." } };
  }

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("your booking page", current.error);
  const before = (current.data.branding ?? {}) as Record<string, unknown>;

  const upload = async (file: File) => {
    const path = `${tenant.id}/brand/${crypto.randomUUID()}.${SERVICE_IMAGE_TYPES[file.type]}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw error;
    return serviceImageUrl(path)!;
  };

  const stale: string[] = [];
  const image = async (key: "logo_url" | "logo_dark_url" | "cover_url", file: File | null, remove: boolean) => {
    const old = typeof before[key] === "string" ? (before[key] as string) : undefined;
    if (!file && !remove) return old;
    if (old?.startsWith(PUBLIC_PREFIX)) stale.push(old.slice(PUBLIC_PREFIX.length));
    return file ? upload(file) : undefined;
  };

  let branding: Record<string, unknown>;
  try {
    branding = {
      ...before,
      ...parsed.data,
      logo_url: await image("logo_url", files.logo, formData.get("remove_logo") === "on"),
      logo_dark_url: await image("logo_dark_url", files.logo_dark, formData.get("remove_logo_dark") === "on"),
      cover_url: await image("cover_url", files.cover, formData.get("remove_cover") === "on"),
    };
  } catch (error) {
    return failed("the images", error);
  }
  // The cover's position goes with the cover: kept if none was sent, gone with it.
  branding.cover_position = branding.cover_url ? (parsed.data.cover_position ?? before.cover_position) : undefined;

  // The email copy of the logo (a PNG every mail app can show), made from a
  // new logo, or from the current one if it hasn't got a copy yet. Emails
  // fall back to the original logo if this fails, so it never stops a save.
  const oldEmailLogo = emailLogoOf(before.email_logo);
  const logoChanged = branding.logo_url !== before.logo_url;
  if (!branding.logo_url) {
    branding.email_logo = undefined;
  } else if (logoChanged || !oldEmailLogo) {
    try {
      const made = files.logo
        ? await makeEmailLogo(await files.logo.arrayBuffer())
        : await emailLogoFromUrl(branding.logo_url as string);
      const path = `${tenant.id}/brand/${crypto.randomUUID()}-email.png`;
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, made.png, { contentType: "image/png" });
      if (error) throw error;
      branding.email_logo = { url: serviceImageUrl(path)!, width: made.width, height: made.height };
    } catch (error) {
      console.error("Couldn't make the email copy of the logo", error);
      branding.email_logo = undefined;
    }
  }
  if (oldEmailLogo && (branding.email_logo as { url?: string } | undefined)?.url !== oldEmailLogo.url && oldEmailLogo.url.startsWith(PUBLIC_PREFIX)) {
    stale.push(oldEmailLogo.url.slice(PUBLIC_PREFIX.length));
  }
  // Blank fields are taken out rather than stored empty.
  for (const key of Object.keys(branding)) if (branding[key] === undefined) delete branding[key];

  const { error } = await supabase.from("tenants").update({ branding }).eq("id", tenant.id);
  if (error) return failed("your booking page", error);
  if (stale.length) await supabase.storage.from(IMAGE_BUCKET).remove(stale);
  await logActivity(tenant.id, "settings.booking_page", "Changed the booking page");
  refresh();
  return { saved: true };
}

// The home page's extra sections: the next free day, the coverage map and the
// places listed beside it. Stored with the rest of the branding.
export async function saveHomePageAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = homeFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("your home page", current.error);
  const branding = { ...((current.data.branding ?? {}) as Record<string, unknown>), home: parsed.data };
  const { error } = await supabase.from("tenants").update({ branding }).eq("id", tenant.id);
  if (error) return failed("your home page", error);
  await logActivity(tenant.id, "settings.booking_page", "Changed what the booking page's home shows");
  refresh();
  return { saved: true };
}

// About you: the owner's name, photo and story, and the facts under the main
// heading. Stored as branding.about.
export async function saveAboutAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = aboutFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const photo = imageFile(formData, "photo");
  const problem = photo && imageProblem(photo);
  if (problem) return { errors: { photo: problem } };

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("your about section", current.error);
  const before = (current.data.branding ?? {}) as Record<string, unknown>;
  const oldPhoto = aboutSchema.parse(before.about).photo_url;

  let photoUrl = oldPhoto;
  if (photo || formData.get("remove_photo") === "on") {
    try {
      photoUrl = photo ? await uploadBrandImage(supabase, tenant.id, photo) : undefined;
    } catch (error) {
      return failed("the photo", error);
    }
  }
  const about: Record<string, unknown> = { ...parsed.data, photo_url: photoUrl };
  for (const key of Object.keys(about)) if (about[key] === undefined) delete about[key];

  const { error } = await supabase
    .from("tenants")
    .update({ branding: { ...before, about } })
    .eq("id", tenant.id);
  if (error) return failed("your about section", error);
  if (oldPhoto && oldPhoto !== photoUrl && oldPhoto.startsWith(PUBLIC_PREFIX)) {
    await supabase.storage.from(IMAGE_BUCKET).remove([oldPhoto.slice(PUBLIC_PREFIX.length)]);
  }
  await logActivity(tenant.id, "settings.booking_page", "Changed the about section on the booking page");
  refresh();
  return { saved: true };
}

// Photos of your work: the gallery in the order the form lists them, with
// new ones uploaded and taken-out ones deleted. Stored as branding.gallery.
export async function saveGalleryAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("your photos", current.error);
  const before = (current.data.branding ?? {}) as Record<string, unknown>;
  const saved = gallerySchema.parse(before.gallery);

  const strings = (name: string) => formData.getAll(name).filter((v): v is string => typeof v === "string");
  const rows = galleryRows(strings("photo"), strings("caption"), saved);

  // Every new file checked before anything is uploaded.
  const files = new Map<string, File>();
  for (const row of rows) {
    if (row.kind !== "new") continue;
    const file = imageFile(formData, `file_${row.key}`);
    if (!file) continue;
    const problem = imageProblem(file);
    if (problem) return { message: problem };
    files.set(row.key, file);
  }

  const gallery: GalleryPhoto[] = [];
  const uploaded: string[] = [];
  try {
    for (const row of rows) {
      let url: string;
      if (row.kind === "saved") url = row.url;
      else {
        const file = files.get(row.key);
        if (!file) continue;
        url = await uploadBrandImage(supabase, tenant.id, file);
        uploaded.push(url);
      }
      gallery.push(row.caption ? { url, caption: row.caption } : { url });
    }
  } catch (error) {
    // Nothing is saved, so the ones that did go up aren't needed.
    const paths = uploaded.filter((u) => u.startsWith(PUBLIC_PREFIX)).map((u) => u.slice(PUBLIC_PREFIX.length));
    if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
    return failed("the photos", error);
  }

  const { error } = await supabase
    .from("tenants")
    .update({ branding: { ...before, gallery } })
    .eq("id", tenant.id);
  if (error) return failed("your photos", error);
  const kept = new Set(gallery.map((p) => p.url));
  const stale = saved.filter((p) => !kept.has(p.url) && p.url.startsWith(PUBLIC_PREFIX)).map((p) => p.url.slice(PUBLIC_PREFIX.length));
  if (stale.length) await supabase.storage.from(IMAGE_BUCKET).remove(stale);
  await logActivity(tenant.id, "settings.booking_page", "Changed the photos of your work on the booking page");
  refresh();
  return { saved: true };
}

// Questions and answers: the list in the order the form sends it (the order
// the owner dragged them into). Stored as branding.faqs.
export async function saveFaqsAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const strings = (name: string) => formData.getAll(name).map((v) => (typeof v === "string" ? v : ""));
  const parsed = parseFaqForm(strings("question"), strings("answer"));
  if (parsed.errors) return { errors: parsed.errors, ...(parsed.errors.faqs && { message: parsed.errors.faqs }) };

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("your questions", current.error);
  const { error } = await supabase
    .from("tenants")
    .update({ branding: { ...((current.data.branding ?? {}) as Record<string, unknown>), faqs: parsed.faqs } })
    .eq("id", tenant.id);
  if (error) return failed("your questions", error);
  await logActivity(tenant.id, "settings.booking_page", "Changed the questions and answers on the booking page");
  refresh();
  return { saved: true };
}

// Trust and enquiries: the deposit line, the jobs count and the enquiry page,
// each switched on and worded. Stored as branding.extras.
export async function saveExtrasAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = extrasFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("these settings", current.error);
  const { error } = await supabase
    .from("tenants")
    .update({ branding: { ...((current.data.branding ?? {}) as Record<string, unknown>), extras: parsed.data } })
    .eq("id", tenant.id);
  if (error) return failed("these settings", error);
  await logActivity(tenant.id, "settings.booking_page", "Changed the trust and enquiry settings on the booking page");
  refresh();
  return { saved: true };
}

// Search and sharing: the home page's title and description in search
// results, the sharing picture, the tab icon (made into a square PNG), the
// Search Console code and whether to stay out of search engines. Stored as
// branding.seo.
export async function saveSeoAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = seoFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const share = imageFile(formData, "share_image");
  const icon = imageFile(formData, "tab_icon");
  for (const [name, file] of [["share_image", share], ["tab_icon", icon]] as const) {
    const problem = file && imageProblem(file);
    if (problem) return { errors: { [name]: problem } };
  }

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("these settings", current.error);
  const branding = (current.data.branding ?? {}) as Record<string, unknown>;
  const before = seoSchema.parse(branding.seo);

  const uploaded: string[] = [];
  let shareUrl = formData.get("remove_share_image") === "on" ? undefined : before.share_image_url;
  let iconUrl = formData.get("remove_tab_icon") === "on" ? undefined : before.icon_url;
  try {
    if (share) uploaded.push((shareUrl = await uploadBrandImage(supabase, tenant.id, share)));
    if (icon) {
      const png = await makeTabIcon(await icon.arrayBuffer());
      uploaded.push((iconUrl = await uploadBrandBytes(supabase, tenant.id, png, "png", "image/png")));
    }
  } catch (error) {
    await removeBrandImages(supabase, uploaded);
    return failed("the images", error);
  }

  const seo: Record<string, unknown> = { ...parsed.data, share_image_url: shareUrl, icon_url: iconUrl };
  for (const key of Object.keys(seo)) if (seo[key] === undefined) delete seo[key];
  const { error } = await supabase
    .from("tenants")
    .update({ branding: { ...branding, seo } })
    .eq("id", tenant.id);
  if (error) {
    await removeBrandImages(supabase, uploaded);
    return failed("these settings", error);
  }
  await removeBrandImages(
    supabase,
    [before.share_image_url, before.icon_url].filter((u): u is string => Boolean(u) && u !== shareUrl && u !== iconUrl),
  );
  await logActivity(tenant.id, "settings.booking_page", "Changed how the booking page shows in search results");
  refresh();
  return { saved: true };
}

// A one-time link to upload a video straight from the browser to the
// business's folder in the site-videos bucket: videos are too big to send
// through a save. The path is ours, never the browser's. Nothing is shown on
// the booking page until the video list is saved with it.
export async function createVideoUploadAction(
  slug: string,
  file: { type: string; size: number },
): Promise<{ path: string; token: string } | { message: string }> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message ?? "Your access level doesn't include changing settings." };
  const ext = VIDEO_TYPES[file.type];
  if (!ext) return { message: "Use an MP4, WebM or MOV video." };
  if (!(file.size > 0) || file.size > MAX_VIDEO_BYTES) {
    return { message: `Videos can be up to ${MAX_VIDEO_BYTES / 1024 / 1024} MB. For a longer one, put it on YouTube and add the link.` };
  }
  const path = `${tenant.id}/videos/${crypto.randomUUID()}.${ext}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Couldn't make a video upload link", error);
    return { message: "Couldn't start the upload. If this is the first video, the site-videos storage may need setting up (migration 20261125140000)." };
  }
  return { path, token: data.token };
}

// Videos of your work: the list in the form's order, uploads and links, each
// with a caption, and the section's heading, text and social link. Uploads
// taken out are deleted. Stored as branding.videos and branding.video_intro.
export async function saveVideosAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const strings = (name: string) => formData.getAll(name).map((v) => (typeof v === "string" ? v : ""));
  const parsed = parseVideosForm(strings("video"), strings("video_caption"), tenant.id);
  if (parsed.errors) return { errors: parsed.errors, message: parsed.errors.videos ?? "Check the highlighted videos." };
  const one = (name: string) => strings(name)[0] ?? "";
  const intro = parseVideoIntro({ heading: one("video_heading"), text: one("video_text"), social: one("social_url") });
  if (intro.errors) return { errors: intro.errors };

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("your videos", current.error);
  const branding = (current.data.branding ?? {}) as Record<string, unknown>;
  const before = uploadedPaths(videosSchema.parse(branding.videos));
  const { error } = await supabase
    .from("tenants")
    .update({ branding: { ...branding, videos: parsed.videos, video_intro: intro.intro } })
    .eq("id", tenant.id);
  if (error) return failed("your videos", error);
  const kept = new Set(uploadedPaths(parsed.videos));
  const stale = before.filter((p) => !kept.has(p));
  if (stale.length) {
    const removed = await supabase.storage.from(VIDEO_BUCKET).remove(stale);
    if (removed.error) console.error("Couldn't remove old videos", removed.error);
  }
  await logActivity(tenant.id, "settings.booking_page", "Changed the videos on the booking page");
  refresh();
  return { saved: true };
}

// ------------------------------------------------------------- Custom domains

export async function addDomainAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = customHostnameSchema().safeParse(String(formData.get("hostname") ?? ""));
  if (!parsed.success) return { errors: { hostname: parsed.error.issues[0].message } };
  try {
    const result = await addCustomDomain(tenant.id, parsed.data);
    if (!result.ok) return { errors: { hostname: result.message } };
  } catch (error) {
    return failed("that address", error);
  }
  await logActivity(tenant.id, "settings.domain_added", `Added the address ${parsed.data}`);
  refresh();
  return { saved: true };
}

export type DomainCheckState = { ok?: boolean; problems?: string[]; message?: string };

export async function checkDomainAction(slug: string, domainId: string): Promise<DomainCheckState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message };
  if (!z.uuid().safeParse(domainId).success) return { message: "That address isn't connected any more." };
  try {
    const result = await checkCustomDomain(tenant.id, domainId);
    refresh();
    return result;
  } catch (error) {
    console.error("Checking a domain failed", error);
    return { message: "Couldn't check the DNS just now. Try again in a minute." };
  }
}

export async function removeDomainAction(slug: string, domainId: string): Promise<{ message?: string }> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message };
  if (!z.uuid().safeParse(domainId).success) return {};
  try {
    await removeCustomDomain(tenant.id, domainId);
  } catch (error) {
    console.error("Removing a domain failed", error);
    return { message: "Couldn't remove it. Try again." };
  }
  await logActivity(tenant.id, "settings.domain_removed", "Removed a web address");
  refresh();
  return {};
}

export async function makePrimaryDomainAction(slug: string, domainId: string): Promise<{ message?: string }> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message };
  if (!z.uuid().safeParse(domainId).success) return {};
  try {
    const result = await makePrimaryDomain(tenant.id, domainId);
    if (!result.ok) return { message: result.message };
  } catch (error) {
    console.error("Changing the main address failed", error);
    return { message: "Couldn't change it. Try again." };
  }
  await logActivity(tenant.id, "settings.domain_primary", "Changed the main web address");
  refresh();
  return {};
}
