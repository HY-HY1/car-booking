"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  MAX_PINNED,
  parseTestimonialForm,
  reviewSettingsSchema,
  testimonialImages,
  togglePinned,
  type ImageRef,
  type Testimonial,
  type TestimonialPhoto,
} from "@leadgen/core/branding/reviews";
import { deleteReviewReply, replyToReview, syncReviews } from "@leadgen/core/reviews/sync";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";
import { imageFile, imageProblem, removeBrandImages, uploadBrandImage } from "@/lib/brand-images";
import { createClient } from "@/lib/supabase/server";

// Replies are public, on Google, as the business: owners and managers only.
const DENIED = "Your access level doesn't include replying to reviews.";

export async function replyToReviewAction(slug: string, reviewId: string, formData: FormData): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("reviews.reply")) return { message: DENIED };
  if (!z.uuid().safeParse(reviewId).success) return { message: "That review is no longer on Google." };
  const result = await replyToReview(tenant.id, reviewId, String(formData.get("reply") ?? ""));
  if (result.error) return { errors: { reply: result.error } };
  await logActivity(tenant.id, "customer.review_replied", "Replied to a Google review");
  refresh();
  return { saved: true };
}

export async function deleteReplyAction(slug: string, reviewId: string): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("reviews.reply")) return { message: DENIED };
  if (!z.uuid().safeParse(reviewId).success) return {};
  const result = await deleteReviewReply(tenant.id, reviewId);
  if (result.error) return { message: result.error };
  await logActivity(tenant.id, "customer.review_reply_deleted", "Deleted a reply to a Google review");
  refresh();
  return {};
}

export async function refreshReviewsPageAction(slug: string): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("customers.view")) return { message: "Your access level doesn't include reviews." };
  const result = await syncReviews(tenant.id);
  refresh();
  return result.error ? { message: result.error } : { saved: true };
}

// "Show on booking page": picks or unpicks a Google review for the booking
// page's reviews section (branding.reviews.pinned). It changes the booking
// page, so it's for whoever can change settings.
export async function pinReviewAction(slug: string, reviewId: string, show: boolean): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { message: "Your access level doesn't include changing the booking page." };
  if (!z.uuid().safeParse(reviewId).success) return { message: "That review is no longer on Google." };

  const supabase = await createClient();
  const [review, current] = await Promise.all([
    supabase.from("google_reviews").select("id, comment").eq("tenant_id", tenant.id).eq("id", reviewId).maybeSingle(),
    supabase.from("tenants").select("branding").eq("id", tenant.id).single(),
  ]);
  if (review.error || current.error) {
    console.error("Picking a review failed", review.error ?? current.error);
    return { message: "Couldn't change that. Try again." };
  }
  if (!review.data) return { message: "That review is no longer on Google." };
  if (show && !review.data.comment?.trim()) return { message: "Only reviews with something written can be shown." };

  const branding = (current.data.branding ?? {}) as Record<string, unknown>;
  const settings = reviewSettingsSchema.parse(branding.reviews);
  const pinned = togglePinned(settings.pinned, reviewId, show);
  if (!pinned) return { message: `You can show up to ${MAX_PINNED}. Take one off first.` };

  const { error } = await supabase
    .from("tenants")
    .update({ branding: { ...branding, reviews: { ...settings, pinned } } })
    .eq("id", tenant.id);
  if (error) {
    console.error("Picking a review failed", error);
    return { message: "Couldn't change that. Try again." };
  }
  await logActivity(tenant.id, "settings.booking_page", show ? "Showed a Google review on the booking page" : "Took a Google review off the booking page");
  refresh();
  return { saved: true };
}

// The Testimonials tab: the booking page's reviews section on or off, and
// testimonials customers sent some other way, each ticked as genuine, with
// the customer's picture and labelled photos of the car if the owner adds
// them. New images are uploaded, ones taken out are deleted. The Google
// reviews picked with "Show on booking page" are kept as they are. Stored as
// branding.reviews; it changes the booking page, so it's for whoever can
// change settings.
export async function saveTestimonialsAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { message: "Your access level doesn't include changing the booking page." };

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) {
    console.error("Saving testimonials failed", current.error);
    return { message: "Couldn't save. Try again." };
  }
  const branding = (current.data.branding ?? {}) as Record<string, unknown>;
  const before = reviewSettingsSchema.parse(branding.reviews);
  const known = new Set(testimonialImages(before.testimonials));

  const strings = (name: string) => formData.getAll(name).map((v) => (typeof v === "string" ? v : ""));
  const rows = strings("row");
  const parsed = parseTestimonialForm(
    {
      rows,
      names: strings("name"),
      texts: strings("text"),
      sources: strings("source"),
      genuine: strings("genuine"),
      avatars: strings("avatar"),
      photos: rows.map((row) => ({ refs: strings(`photo_${row}`), labels: strings(`photo_label_${row}`) })),
    },
    known,
  );
  if (parsed.errors) return { errors: parsed.errors, ...(parsed.errors.testimonials && { message: parsed.errors.testimonials }) };

  // Every new file checked before anything is uploaded.
  const files = new Map<string, File>();
  for (const plan of parsed.testimonials) {
    for (const ref of [plan.avatar, ...plan.photos.map((p) => p.image)]) {
      if (ref?.kind !== "new") continue;
      const file = imageFile(formData, `file_${ref.key}`);
      if (!file) continue;
      const problem = imageProblem(file);
      if (problem) return { message: problem };
      files.set(ref.key, file);
    }
  }

  const uploaded: string[] = [];
  const resolve = async (ref: ImageRef | null) => {
    if (!ref) return undefined;
    if (ref.kind === "saved") return ref.url;
    const file = files.get(ref.key);
    if (!file) return undefined;
    const url = await uploadBrandImage(supabase, tenant.id, file);
    uploaded.push(url);
    return url;
  };
  const testimonials: Testimonial[] = [];
  try {
    for (const plan of parsed.testimonials) {
      const avatar_url = await resolve(plan.avatar);
      const photos: TestimonialPhoto[] = [];
      for (const p of plan.photos) {
        const url = await resolve(p.image);
        if (url) photos.push(p.label ? { url, label: p.label } : { url });
      }
      testimonials.push({
        name: plan.name,
        text: plan.text,
        ...(plan.source && { source: plan.source }),
        ...(avatar_url && { avatar_url }),
        photos,
      });
    }
  } catch (error) {
    // Nothing is saved, so the ones that did go up aren't needed.
    console.error("Uploading testimonial images failed", error);
    await removeBrandImages(supabase, uploaded);
    return { message: "Couldn't upload the images. Try again, or try smaller ones." };
  }

  const reviews = { ...before, show: formData.get("show") === "on", testimonials };
  const { error } = await supabase
    .from("tenants")
    .update({ branding: { ...branding, reviews } })
    .eq("id", tenant.id);
  if (error) {
    console.error("Saving testimonials failed", error);
    await removeBrandImages(supabase, uploaded);
    return { message: "Couldn't save. Try again." };
  }
  // The images no testimonial uses any more.
  const kept = new Set(testimonialImages(testimonials));
  await removeBrandImages(supabase, [...known].filter((url) => !kept.has(url)));
  await logActivity(tenant.id, "settings.booking_page", "Changed the reviews on the booking page");
  refresh();
  return { saved: true };
}
