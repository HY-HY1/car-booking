import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { MAX_PHOTOS, PHOTO_BUCKET } from "../photos";
import { createAdminClient } from "../supabase/admin";
import { conditionTierSchema, type ConditionTier } from "./config";
import {
  assessmentOutputSchema,
  assessmentPrompt,
  decideAssessment,
  type AssessmentStatus,
  type ConditionAssessment,
} from "./condition";

// assess_photos: rates a car's condition from the photos the customer
// uploaded, against the business's condition levels, and stores the result.
// The booking form sends back the id it gets; quotes read the level from the
// stored row, so the price can't be set from the browser. Any failure is a
// "failed" check: the job is booked without a condition uplift and the owner
// looks at the car, so booking never depends on this call working.

const MODEL = "claude-opus-5-5";
// The customer is waiting on the booking form, so keep the thinking short and
// give up rather than hang: worst case is one retry of 25 seconds.
const EFFORT = "low";
const TIMEOUT_MS = 25_000;
// The same photos are only checked once while someone books; the rows are
// copied into the quote snapshot, so older ones can go.
const REUSE_HOURS = 24;
const KEEP_DAYS = 7;

const photoIdsSchema = z.array(z.uuid()).min(1).max(MAX_PHOTOS);

let anthropic: Anthropic | undefined;
function client() {
  // Reads ANTHROPIC_API_KEY. Retries once on rate limits and server errors.
  anthropic ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return anthropic;
}

type Row = { id: string; status: AssessmentStatus; condition_key: string | null; confidence: number | null; summary: string | null };
const COLUMNS = "id, status, condition_key, confidence, summary";

function fromRow(row: Row): ConditionAssessment {
  return {
    id: row.id,
    status: row.status,
    conditionKey: row.condition_key,
    confidence: row.confidence === null ? null : Number(row.confidence),
    summary: row.summary,
  };
}

async function conditionTiers(tenantId: string): Promise<ConditionTier[]> {
  const { data, error } = await createAdminClient()
    .from("booking_settings")
    .select("condition_tiers")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return z.array(conditionTierSchema).parse(data?.condition_tiers ?? []);
}

export type AssessResult =
  | { ok: true; assessment: ConditionAssessment }
  | { ok: false; code: string; message: string };

export async function assessCondition(tenantId: string, input: unknown): Promise<AssessResult> {
  const parsed = photoIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input", message: "Those photos couldn't be checked." };
  const photoIds = [...new Set(parsed.data)].sort();

  // Not set up yet: bookings go through unchecked, as if there were no photos.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY isn't set, so photos aren't being checked.");
    return { ok: false, code: "not_configured", message: "Photos can't be checked right now." };
  }

  const tiers = await conditionTiers(tenantId);
  if (!tiers.length) {
    return { ok: false, code: "not_priced_by_condition", message: "This business doesn't price by condition." };
  }

  const db = createAdminClient();
  // Opportunistic tidy-up, as with abandoned photo uploads.
  const stale = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  const tidy = await db.from("condition_assessments").delete().eq("tenant_id", tenantId).lt("created_at", stale);
  if (tidy.error) console.error("Couldn't delete old condition checks", tidy.error);

  // Same set of photos checked recently: reuse it. Failed checks are retried.
  const since = new Date(Date.now() - REUSE_HOURS * 3_600_000).toISOString();
  const previous = await db
    .from("condition_assessments")
    .select(COLUMNS)
    .eq("tenant_id", tenantId)
    .contains("photo_ids", photoIds)
    .containedBy("photo_ids", photoIds)
    .neq("status", "failed")
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previous.error) throw previous.error;
  if (previous.data) return { ok: true, assessment: fromRow(previous.data) };

  const photos = await db
    .from("photos")
    .select("id, storage_path, content_type")
    .eq("tenant_id", tenantId)
    .in("id", photoIds);
  if (photos.error) throw photos.error;
  if (photos.data.length !== photoIds.length) {
    return { ok: false, code: "unknown_photo", message: "One of the photos has gone. Add it again." };
  }

  const result = await rate(tiers, photoIds.map((id) => photos.data.find((p) => p.id === id)!));
  const { data, error } = await db
    .from("condition_assessments")
    .insert({
      tenant_id: tenantId,
      photo_ids: photoIds,
      status: result.status,
      condition_key: result.conditionKey,
      confidence: result.confidence,
      summary: result.summary,
      model: MODEL,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return { ok: true, assessment: fromRow(data) };
}

const FAILED = { status: "failed", conditionKey: null, confidence: null, summary: null } as const;

async function rate(
  tiers: ConditionTier[],
  photos: { storage_path: string; content_type: string }[],
): Promise<Omit<ConditionAssessment, "id">> {
  try {
    const db = createAdminClient();
    const images: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const [i, photo] of photos.entries()) {
      const file = await db.storage.from(PHOTO_BUCKET).download(photo.storage_path);
      if (file.error) throw file.error;
      images.push(
        { type: "text", text: `Photo ${i + 1} of ${photos.length}:` },
        {
          type: "image",
          source: {
            type: "base64",
            // Checked against the file's own bytes when it was uploaded (photos.ts).
            media_type: photo.content_type as "image/jpeg" | "image/png" | "image/webp",
            data: Buffer.from(await file.data.arrayBuffer()).toString("base64"),
          },
        },
      );
    }

    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      // A declined request is retried server-side on the recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT, format: betaZodOutputFormat(assessmentOutputSchema(tiers)) },
      system: assessmentPrompt(tiers),
      messages: [
        {
          role: "user",
          content: [...images, { type: "text", text: "Which condition level is this car in?" }],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.error("Condition check gave no answer", response.stop_reason, response.stop_details);
      return FAILED;
    }
    return decideAssessment(response.parsed_output, tiers);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Condition check failed: ${error.status}`, error.message);
    } else {
      console.error("Condition check failed", error);
    }
    return FAILED;
  }
}

// A check the booking form sent back, if it's this business's. Unknown ids
// read as no check at all.
export async function loadAssessment(tenantId: string, id: string): Promise<ConditionAssessment | null> {
  const { data, error } = await createAdminClient()
    .from("condition_assessments")
    .select(COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}
