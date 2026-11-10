import { runReviewJobs } from "@leadgen/core/reviews/sync";
import { runWebhookJobs } from "@leadgen/core/webhooks/deliver";

// GET /api/jobs/integrations: retries webhooks that haven't got through,
// clears out old webhook deliveries, and rereads every connected business's
// Google reviews. Daily (vercel.json); same CRON_SECRET as the other jobs.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const [webhooks, reviews] = await Promise.allSettled([runWebhookJobs(), runReviewJobs()]);
  const outcome = (r: PromiseSettledResult<unknown>) => {
    if (r.status === "fulfilled") return r.value;
    console.error("Integrations job failed", r.reason);
    return { error: true };
  };
  return Response.json({ ok: true, webhooks: outcome(webhooks), reviews: outcome(reviews) });
}
