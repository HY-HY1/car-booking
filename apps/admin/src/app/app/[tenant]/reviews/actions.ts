"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { deleteReviewReply, replyToReview, syncReviews } from "@leadgen/core/reviews/sync";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";

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
