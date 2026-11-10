import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { z } from "zod";
import { answersOf } from "@leadgen/core/booking/answers";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { formatPhone } from "@leadgen/core/customer-fields";
import { BackLink } from "@/components/dashboard/page-header";
import { SubmittedAnswers } from "@/components/dashboard/submitted-answers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConditionNote } from "@/components/dashboard/condition-note";
import { BOOKING_SOURCE, quoteOf, submittedGroups } from "@/lib/booking-display";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { formatDateTime } from "@leadgen/core/dates";
import { LOST_REASONS } from "@leadgen/core/leads/rules";
import { LeadActions } from "@/components/dashboard/lead-actions";
import { markLeadLostAction, recordContactAction, reopenLeadAction, saveLeadNotesAction } from "../actions";

export const metadata: Metadata = { title: "Lead" };

const STATUS: Record<string, string> = { new: "New", quoted: "Quoted", booked: "Booked", lost: "Lost" };

// From a Facebook or Instagram lead form (meta/leads.ts).
type FormAnswers = {
  form?: string | null;
  ad?: string | null;
  campaign?: string | null;
  organic?: boolean | null;
  answers?: { question: string; answer: string }[];
};

type LeadRow = {
  id: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  form_answers: FormAnswers | null;
  lost_reason: string | null;
  last_contacted_at: string | null;
  attempts: number;
  quote_snapshot: (Record<string, unknown> & { postcode?: string | null; location_type?: "mobile" | "unit"; size_class?: string }) | null;
  customer: { id: string; name: string; email: string | null; phone: string | null; email_marketing: boolean } | null;
  photos: { count: number }[];
};

export default async function LeadPage({ params }: PageProps<"/app/[tenant]/leads/[id]">) {
  const { tenant: slug, id } = await params;
  const { tenant } = await requireAccess(slug, "leads.view");
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, status, source, created_at, updated_at, notes, form_answers, lost_reason, last_contacted_at, attempts, quote_snapshot, customer:customers(id, name, email, phone, email_marketing), photos(count)",
    )
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const lead = data as unknown as LeadRow;

  const quote = quoteOf(lead.quote_snapshot);
  const snapshot = lead.quote_snapshot;
  const total = typeof snapshot?.total_pence === "number" ? snapshot.total_pence : null;
  const photos = lead.photos[0]?.count ?? 0;
  const groups = submittedGroups({
    answers: answersOf(snapshot),
    vehicle: snapshot?.size_class ? { make: null, model: null, registration: null, size_class: snapshot.size_class } : null,
    postcode: snapshot?.postcode,
    locationType: snapshot?.location_type,
    marketing: lead.customer?.email_marketing,
  });

  return (
    <>
      <BackLink href={appUrl(`/${slug}/leads`)}>Leads</BackLink>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {typeof snapshot?.service_name === "string" ? snapshot.service_name : "Enquiry"}
          {total !== null && <span className="text-muted-foreground"> · {formatPence(total)}</span>}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {STATUS[lead.status] ?? lead.status} · {BOOKING_SOURCE[lead.source] ?? lead.source} · received{" "}
          {formatDateTime(lead.created_at)}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          {lead.form_answers && (
            <Card>
              <CardHeader>
                <CardTitle>Their answers on the form</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <dl className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  {(lead.form_answers.answers ?? []).map((a, i) => (
                    <div key={i} className="contents">
                      <dt className="text-muted-foreground">{a.question}</dt>
                      <dd className="break-words">{a.answer}</dd>
                    </div>
                  ))}
                </dl>
                {(lead.form_answers.form || lead.form_answers.ad || lead.form_answers.campaign) && (
                  <p className="border-t pt-2 text-muted-foreground">
                    {[
                      lead.form_answers.form && `Form: ${lead.form_answers.form}`,
                      lead.form_answers.ad && `Ad: ${lead.form_answers.ad}`,
                      lead.form_answers.campaign && `Campaign: ${lead.form_answers.campaign}`,
                      lead.form_answers.organic && "Not from an ad",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {!lead.form_answers && (
          <Card>
            <CardHeader>
              <CardTitle>Everything they submitted</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <SubmittedAnswers groups={groups} />
              {photos > 0 && lead.customer && (
                <Link
                  href={appUrl(`/${slug}/customers/${lead.customer.id}#photos`)}
                  className="w-fit text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {photos} {photos === 1 ? "photo" : "photos"} from the customer
                </Link>
              )}
            </CardContent>
          </Card>
          )}

          {quote && quote.lines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>The quote they saw</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1.5">
                {quote.lines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{l.label}</span>
                    <span>{formatPence(l.amount_pence)}</span>
                  </div>
                ))}
                {total !== null && (
                  <div className="mt-1 flex justify-between gap-4 border-t pt-2 font-medium">
                    <span>Total</span>
                    <span>{formatPence(total)}</span>
                  </div>
                )}
                {quote.durationMins && (
                  <p className="pt-1 text-muted-foreground">About {formatDuration(quote.durationMins)}</p>
                )}
                <div className="pt-1">
                  <ConditionNote condition={quote.condition} needsInspection={quote.needsInspection} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Follow this up</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadActions
              open={lead.status === "new" || lead.status === "quoted"}
              lost={lead.status === "lost"}
              notes={lead.notes ?? ""}
              contactLine={
                lead.status === "lost" && lead.lost_reason
                  ? `Lost: ${LOST_REASONS[lead.lost_reason as keyof typeof LOST_REASONS] ?? lead.lost_reason}`
                  : lead.last_contacted_at
                    ? `Contacted ${lead.attempts} ${lead.attempts === 1 ? "time" : "times"}, last on ${formatDateTime(lead.last_contacted_at)}`
                    : "Not contacted yet."
              }
              bookHref={lead.customer ? appUrl(`/${slug}/bookings/new?customer=${lead.customer.id}&lead=${lead.id}`) : null}
              saveNotes={saveLeadNotesAction.bind(null, slug, lead.id)}
              recordContact={recordContactAction.bind(null, slug, lead.id, lead.attempts)}
              markLost={markLeadLostAction.bind(null, slug, lead.id)}
              reopen={reopenLeadAction.bind(null, slug, lead.id)}
            />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {lead.customer ? (
              <>
                <Link
                  href={appUrl(`/${slug}/customers/${lead.customer.id}`)}
                  className="w-fit font-medium underline-offset-4 hover:underline"
                >
                  {lead.customer.name}
                </Link>
                {lead.customer.phone && (
                  <a href={`tel:${lead.customer.phone}`} className="flex items-center gap-2 hover:underline">
                    <Phone className="size-4 text-muted-foreground" />
                    {formatPhone(lead.customer.phone)}
                  </a>
                )}
                {lead.customer.email && (
                  <a href={`mailto:${lead.customer.email}`} className="flex items-center gap-2 break-all hover:underline">
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    {lead.customer.email}
                  </a>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No customer on this lead.</p>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}
