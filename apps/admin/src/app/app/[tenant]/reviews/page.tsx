import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Star } from "lucide-react";
import { formatDate } from "@leadgen/core/dates";
import { reviewSummary } from "@leadgen/core/reviews/rules";
import { STALE_MS, syncReviews } from "@leadgen/core/reviews/sync";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewReply } from "@/components/dashboard/review-reply";
import { ActionButton } from "@/components/dashboard/settings/connection-bits";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { deleteReplyAction, refreshReviewsPageAction, replyToReviewAction } from "./actions";

export const metadata: Metadata = { title: "Reviews" };

const FILTERS = { waiting: "Needs a reply", all: "All" } as const;
type Filter = keyof typeof FILTERS;

type ReviewRow = {
  id: string;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  rating: number | null;
  comment: string | null;
  reply: string | null;
  created_at_google: string;
};

export default async function ReviewsPage({ params, searchParams }: PageProps<"/app/[tenant]/reviews">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "customers.view");
  const sp = await searchParams;
  const filter: Filter = sp.show === "all" ? "all" : "waiting";

  const supabase = await createClient();
  const [connection, all] = await Promise.all([
    supabase
      .from("google_business_connections")
      .select("location_title, review_url, average_rating, total_reviews, status, last_error, last_synced_at")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabase
      .from("google_reviews")
      .select("id, reviewer_name, reviewer_photo_url, rating, comment, reply, created_at_google")
      .eq("tenant_id", tenant.id)
      .order("created_at_google", { ascending: false })
      .limit(500),
  ]);
  if (connection.error) throw connection.error;
  if (all.error) throw all.error;
  const conn = connection.data;
  const reviews = all.data as ReviewRow[];

  const integrations = appUrl(`/${slug}/settings/integrations`);
  if (!conn) {
    return (
      <>
        <PageHeader title="Reviews" />
        <EmptyState
          title="Connect Google to see your reviews here"
          action={
            can("settings.edit") ? (
              <Link href={integrations} className={buttonVariants()}>
                Go to Integrations
              </Link>
            ) : undefined
          }
        >
          Read every Google review in one place and reply to them as your business, without opening Google.
        </EmptyState>
      </>
    );
  }

  // Reread in the background when the copy is old; the next visit shows it.
  const stale = !conn.last_synced_at || new Date().getTime() - new Date(conn.last_synced_at).getTime() > STALE_MS;
  if (stale && conn.status === "active") after(() => syncReviews(tenant.id));

  const summary = reviewSummary(reviews);
  const shown = filter === "waiting" ? reviews.filter((r) => !r.reply) : reviews;
  const base = appUrl(`/${slug}/reviews`);
  const canReply = can("reviews.reply") && conn.status === "active";

  return (
    <>
      <PageHeader title="Reviews" description={conn.location_title ? `Google reviews for ${conn.location_title}` : undefined} />

      {conn.status !== "active" && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          Google needs reconnecting, so these may be out of date and replies can&apos;t be posted.{" "}
          <Link href={integrations} className="underline underline-offset-2">
            Reconnect in Integrations
          </Link>
        </p>
      )}
      {conn.status === "active" && conn.last_error && <p className="mb-4 text-sm text-destructive">{conn.last_error}</p>}

      <section aria-label="Summary" className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border p-4 text-sm">
        <div>
          <p className="flex items-center gap-1.5 text-2xl font-semibold">
            {conn.average_rating !== null ? Number(conn.average_rating).toFixed(1) : (summary.average?.toFixed(1) ?? "–")}
            <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
          </p>
          <p className="text-muted-foreground">{conn.total_reviews ?? reviews.length} reviews on Google</p>
        </div>
        <ul className="grid min-w-40 gap-0.5">
          {summary.byStars.map((s) => (
            <li key={s.stars} className="flex items-center gap-2">
              <span className="w-3 text-right tabular-nums">{s.stars}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-amber-400"
                  style={{ width: reviews.length ? `${(s.count / reviews.length) * 100}%` : 0 }}
                />
              </span>
              <span className="w-6 tabular-nums text-muted-foreground">{s.count}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2">
          <p>{summary.unanswered === 0 ? "Every review has a reply." : `${summary.unanswered} waiting for a reply.`}</p>
          <div className="flex flex-wrap gap-2">
            {conn.status === "active" && (
              <ActionButton
                label="Check for new reviews"
                busyLabel="Checking…"
                done="Reviews updated"
                action={refreshReviewsPageAction.bind(null, slug)}
              />
            )}
            {conn.review_url && (
              <a href={conn.review_url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost" })}>
                Your review link
              </a>
            )}
          </div>
        </div>
      </section>

      <nav className="mb-4 flex gap-1">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link
            key={f}
            href={f === "waiting" ? base : `${base}?show=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted",
              filter === f && "bg-muted text-foreground",
            )}
          >
            {FILTERS[f]}
            {f === "waiting" && summary.unanswered > 0 ? ` (${summary.unanswered})` : ""}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <EmptyState compact>
          {reviews.length === 0
            ? conn.last_synced_at
              ? "No reviews on Google yet."
              : "Your reviews are being fetched from Google. Check back in a minute."
            : "Every review has a reply."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {shown.map((r) => (
            <li key={r.id} className="grid gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                {r.reviewer_photo_url ? (
                  // Google's own image host; a plain img keeps it off our image optimiser.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.reviewer_photo_url} alt="" className="size-9 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-full bg-muted text-sm font-medium" aria-hidden>
                    {(r.reviewer_name ?? "?").charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.reviewer_name ?? "A Google user"}</p>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    {r.rating !== null && (
                      <span className="flex" aria-label={`${r.rating} out of 5 stars`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            aria-hidden
                            className={cn("size-3.5", n <= (r.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
                          />
                        ))}
                      </span>
                    )}
                    {formatDate(r.created_at_google)}
                  </p>
                </div>
              </div>
              {r.comment ? (
                <p className="whitespace-pre-wrap text-sm">{r.comment}</p>
              ) : (
                <p className="text-sm text-muted-foreground">A rating with no written review.</p>
              )}
              <ReviewReply
                reply={r.reply}
                canReply={canReply}
                saveAction={replyToReviewAction.bind(null, slug, r.id)}
                deleteAction={deleteReplyAction.bind(null, slug, r.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
