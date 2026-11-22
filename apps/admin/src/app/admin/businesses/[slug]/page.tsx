import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { formatDate, formatDateTime, formatDayTime } from "@leadgen/core/dates";
import type { SetupStepKey } from "@leadgen/core/onboarding/steps";
import { getBusinessBySlug } from "@leadgen/core/platform/businesses";
import { getBusinessDetail, type Connection } from "@leadgen/core/platform/detail";
import { slugSchema } from "@leadgen/core/platform/rules";
import { stripeMode } from "@leadgen/core/platform/system";
import { closureDate } from "@leadgen/core/settings/account";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import { isCustomHostname } from "@leadgen/core/tenants";
import { StatTile } from "@/components/dashboard/overview/stat-tile";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/platform/action-button";
import { ActivityList } from "@/components/platform/activity-list";
import { CopyText } from "@/components/platform/copy-text";
import { DeleteBusiness } from "@/components/platform/delete-business";
import { DomainForm } from "@/components/platform/domain-form";
import { MemberForm } from "@/components/platform/member-form";
import { MemberRow } from "@/components/platform/member-row";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePlatformAdmin } from "@/lib/platform";
import { ago, gbp, isPast, plan, STATUS_TONE } from "@/lib/platform-format";
import { loadSetupWith } from "@/lib/setup";
import { adminUrl, appUrl, tenantUrl } from "@/lib/urls";
import {
  cancelClosureAction,
  deleteBusinessAction,
  joinAction,
  makePrimaryAction,
  removeDomainAction,
  removeMemberAction,
  resetTwoFactorAction,
  resyncBillingAction,
  setRoleAction,
  setVerifiedAction,
} from "./actions";

export const metadata: Metadata = { title: "Business" };

const STEP_LABEL: Record<SetupStepKey, string> = {
  services: "Services and prices checked",
  hours: "Working hours set",
  area: "Van start point set",
  payments: "Stripe connected",
  email: "Own email address",
  address: "Booking page live",
  enquiry: "First enquiry or booking",
};

const CONNECTION_TONE: Record<Connection["state"], BadgeTone> = { on: "success", off: "neutral", problem: "warning" };
const CONNECTION_WORD: Record<Connection["state"], string> = { on: "On", off: "Off", problem: "Check" };

export default function BusinessPage({ params }: PageProps<"/admin/businesses/[slug]">) {
  return (
    <>
      <BackLink href={adminUrl("/businesses")}>Businesses</BackLink>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Business params={params} />
      </Suspense>
    </>
  );
}

function stripeDashboard(path: string) {
  return `https://dashboard.stripe.com/${stripeMode() === "test" ? "test/" : ""}${path}`;
}

async function Business({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = await requirePlatformAdmin(adminUrl(`/businesses/${slug}`));
  if (!slugSchema.safeParse(slug).success) notFound();
  const b = await getBusinessBySlug(slug);
  if (!b) notFound();
  const [d, setup] = await Promise.all([getBusinessDetail(b), loadSetupWith(createAdminClient(), b.id)]);

  // Its own domains; the free address (/booking/<slug>, <slug>.domain.com) isn't one.
  const domains = b.domains.filter((x) => isCustomHostname(x.hostname));
  const customDomain = domains.find((x) => x.isPrimary && x.verified)?.hostname ?? null;
  const bookingLink = tenantUrl(b.slug, "/", { absolute: true, customDomain });
  const isMember = b.members.some((m) => m.userId === admin.id);
  const p = plan(d.billing.status, d.billing.trialEndsAt);
  const sub = d.billing.subscription;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeader title={b.name} description={`Dashboard ID ${b.slug} · ${d.profile.trade} · added ${formatDate(b.createdAt)}`} />
          <div className="-mt-4 flex flex-wrap gap-2">
            <Badge tone={p.tone}>{p.label}</Badge>
            {setup && <Badge tone={setup.progress.ready ? "success" : "warning"}>{setup.progress.ready ? "Set up" : `Setup ${setup.progress.doneRequired}/${setup.progress.totalRequired}`}</Badge>}
            {b.deletionRequestedAt && <Badge tone="danger">Closing</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={bookingLink} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            Booking page <ExternalLink />
          </a>
          {isMember ? (
            <Link href={appUrl(`/${b.slug}`)} className={buttonVariants()}>
              Open their dashboard
            </Link>
          ) : (
            <ActionButton
              action={joinAction.bind(null, b.slug)}
              variant="default"
              size="default"
              pendingLabel="Adding you…"
              success="You're on this business as an owner"
              confirm={{
                title: `Join ${b.name} as an owner?`,
                description: "You'll be able to open their dashboard. They'll see you in their team list and activity log; remove yourself under People when you're done.",
                confirmLabel: "Join",
              }}
            >
              Join to open dashboard
            </ActionButton>
          )}
        </div>
      </div>

      {b.deletionRequestedAt && <ClosureBanner slug={b.slug} requestedAt={b.deletionRequestedAt} />}

      <section aria-label="Usage" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Bookings" value={String(d.usage.bookings)} note={`${d.usage.upcoming} coming up · last made ${ago(d.usage.lastBookingAt)}`} />
        <StatTile label="Booked, last 30 days" value={String(d.usage.booked30)} note={`${gbp(d.usage.value30Pence)} · ${d.usage.cancelled30} cancelled`} />
        <StatTile label="Enquiries" value={String(d.usage.leads)} note={`${d.usage.leads30} in 30 days · last ${ago(d.usage.lastLeadAt)}`} />
        <StatTile label="Customers" value={String(d.usage.customers)} note={`${d.usage.services} active ${d.usage.services === 1 ? "service" : "services"}`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>What they pay you.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge tone={p.tone}>{p.label}</Badge>
              </dd>
              {sub && (
                <>
                  <dt className="text-muted-foreground">Price</dt>
                  <dd>{sub.priceLabel || "—"}</dd>
                  <dt className="text-muted-foreground">{sub.cancelsAtPeriodEnd ? "Ends" : "Next charge"}</dt>
                  <dd>{sub.periodEnd ? formatDate(sub.periodEnd) : "—"}{sub.cancelsAtPeriodEnd && <span className="ml-1 text-destructive">(set to cancel)</span>}</dd>
                </>
              )}
              {d.profile.termsAcceptedAt && (
                <>
                  <dt className="text-muted-foreground">Terms</dt>
                  <dd>
                    Accepted {formatDate(d.profile.termsAcceptedAt)}
                    {d.profile.termsVersion && <span className="text-muted-foreground"> (version {d.profile.termsVersion})</span>}
                  </dd>
                </>
              )}
            </dl>
            {d.billing.stripeError && <p className="text-destructive">Couldn&apos;t reach Stripe for the latest details.</p>}
            {d.billing.status === null && <p className="text-muted-foreground">Not billed through the app: invoice them yourself. They&apos;re never locked out.</p>}
            <div className="flex flex-wrap gap-2">
              <ActionButton action={resyncBillingAction.bind(null, b.slug)} pendingLabel="Checking Stripe…">
                Re-read from Stripe
              </ActionButton>
              {d.billing.customerId && (
                <a href={stripeDashboard(`customers/${d.billing.customerId}`)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Open in Stripe <ExternalLink />
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
            <CardDescription>The checklist the owner sees, worked out from what they&apos;ve set up.</CardDescription>
          </CardHeader>
          <CardContent>
            {setup ? (
              <ul className="grid gap-1.5 text-sm">
                {setup.steps.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-3">
                    <span className={s.done ? "" : "text-muted-foreground"}>{STEP_LABEL[s.key]}</span>
                    {s.done ? (
                      <Badge tone="success">Done</Badge>
                    ) : (
                      <Badge tone={s.state === "waiting_on_us" ? "danger" : s.state === "in_progress" ? "warning" : "neutral"}>
                        {s.state === "waiting_on_us" ? "On you" : s.state === "in_progress" ? "Started" : s.required ? "To do" : "Optional"}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Booking was never set up for this business (no booking settings).</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
            <CardDescription>What they&apos;ve plugged in.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {(
                [
                  ["Stripe payments", d.connections.stripe],
                  ["Own email address", d.connections.email],
                  ["Google Calendar", d.connections.calendar],
                  ["Google reviews", d.connections.googleReviews],
                  ["Facebook lead forms", d.connections.meta],
                  ["Webhooks", d.connections.webhooks],
                  ["API keys", d.connections.apiKeys],
                ] as const
              ).map(([label, c]) => (
                <li key={label} className="grid grid-cols-[8.5rem_auto_1fr] items-baseline gap-2">
                  <span>{label}</span>
                  <Badge tone={CONNECTION_TONE[c.state]}>{CONNECTION_WORD[c.state]}</Badge>
                  <span className="min-w-0 truncate text-muted-foreground">{c.detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emails, last 30 days</CardTitle>
            <CardDescription>Everything sent for them: confirmations, reminders, alerts.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["Sent", d.emails30.sent, ""],
                  ["Failed", d.emails30.failed, d.emails30.failed ? "text-destructive" : ""],
                  ["Bounced", d.emails30.bounced, d.emails30.bounced ? "text-amber-700 dark:text-amber-400" : ""],
                  ["Spam reports", d.emails30.complained, d.emails30.complained ? "text-destructive" : ""],
                ] as const
              ).map(([label, n, tone]) => (
                <div key={label} className="rounded-lg bg-muted/50 p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={`text-lg font-semibold tabular-nums ${tone}`}>{n}</dd>
                </div>
              ))}
            </dl>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Contact email</dt>
              <dd className="truncate">{d.profile.contactEmail ?? "—"}</dd>
              <dt className="text-muted-foreground">Contact phone</dt>
              <dd>{d.profile.contactPhone ?? "—"}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Latest bookings</CardTitle>
            <CardDescription>The ten most recently made. Customers&apos; details stay in their dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            {d.recentBookings.length === 0 ? (
              <EmptyState compact>No bookings yet.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-4 font-medium">For</th>
                      <th className="py-1.5 pr-4 font-medium">Service</th>
                      <th className="py-1.5 pr-4 font-medium">Status</th>
                      <th className="py-1.5 pr-4 text-right font-medium">Price</th>
                      <th className="py-1.5 pr-4 font-medium">Deposit</th>
                      <th className="py-1.5 font-medium">Made</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.recentBookings.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 pr-4 whitespace-nowrap">{formatDayTime(r.startsAt)}</td>
                        <td className="py-2 pr-4">{r.service ?? "—"}</td>
                        <td className="py-2 pr-4">
                          <Badge tone={STATUS_TONE[r.status] ?? "neutral"} className="capitalize">
                            {r.status.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{gbp(r.pricePence)}</td>
                        <td className="py-2 pr-4 capitalize">{r.depositStatus === "none" ? "—" : r.depositStatus}</td>
                        <td className="py-2 whitespace-nowrap text-muted-foreground">
                          {formatDateTime(r.createdAt)}
                          {r.source !== "booking_page" && <span className="ml-1">· {r.source.replaceAll("_", " ")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking page</CardTitle>
            <CardDescription>Where customers book, and the script for the owner&apos;s own website.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <CopyText value={bookingLink} label="booking address" />
            <p className="text-xs text-muted-foreground">Add to their website, before the closing body tag:</p>
            <CopyText value={`<script src="${tenantUrl(b.slug, "/embed.js", { absolute: true, customDomain })}" async></script>`} label="embed script" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Own domains</CardTitle>
            <CardDescription>
              The booking page always works at its free address. Their own domain takes over once it&apos;s verified and primary. Owners can add
              one themselves under Settings; here you can do it for them.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="divide-y rounded-lg border">
              {domains.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
                  <span className="font-mono">{x.hostname}</span>
                  <span className="text-xs text-muted-foreground">{[x.isPrimary && "Primary", x.verified ? "Verified" : "Not verified"].filter(Boolean).join(" · ")}</span>
                  <div className="ml-auto flex flex-wrap gap-1">
                    <form action={setVerifiedAction.bind(null, b.slug, x.id, !x.verified)}>
                      <Button type="submit" variant="outline" size="sm">
                        {x.verified ? "Mark unverified" : "Mark verified"}
                      </Button>
                    </form>
                    {!x.isPrimary && (
                      <form action={makePrimaryAction.bind(null, b.slug, x.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Make primary
                        </Button>
                      </form>
                    )}
                    <ActionButton
                      action={removeDomainAction.bind(null, b.slug, x.id)}
                      variant="ghost"
                      success={`Removed ${x.hostname}`}
                      confirm={{
                        title: `Remove ${x.hostname}?`,
                        description: "The booking page goes back to its free address straight away. Links already sent with this domain stop working.",
                        confirmLabel: "Remove",
                        destructive: true,
                      }}
                    >
                      Remove
                    </ActionButton>
                  </div>
                </li>
              ))}
              {domains.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">None.</li>}
            </ul>
            <DomainForm slug={b.slug} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>Who can sign in to this business, and what they can do. Every business keeps at least one owner.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="divide-y rounded-lg border">
              {b.members.map((m) => (
                <MemberRow
                  key={m.userId}
                  email={m.email}
                  role={m.role}
                  isYou={m.userId === admin.id}
                  setRole={setRoleAction.bind(null, b.slug, m.userId)}
                  remove={removeMemberAction.bind(null, b.slug, m.userId)}
                  resetTwoFactor={resetTwoFactorAction.bind(null, b.slug, m.userId)}
                />
              ))}
              {b.members.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nobody yet.</li>}
            </ul>
            <MemberForm slug={b.slug} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>The latest from their activity log, including anything done from here.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ActivityList rows={d.activity} showBusiness={false} />
            <Link href={adminUrl(`/activity?business=${b.slug}`)} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              All their activity
            </Link>
          </CardContent>
        </Card>

        <Card className="ring-destructive/30 lg:col-span-2">
          <CardHeader>
            <CardTitle>Delete business</CardTitle>
            <CardDescription>
              For an account closed from Settings → Privacy once its 30 days are up, or one made by mistake. Cancels their subscription and deletes
              everything. Their own Stripe account is theirs and isn&apos;t touched.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteBusiness name={b.name} slug={b.slug} action={deleteBusinessAction.bind(null, b.slug)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClosureBanner({ slug, requestedAt }: { slug: string; requestedAt: string }) {
  const due = closureDate(requestedAt);
  const overdue = isPast(due);
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p>
        <span className="font-medium">The owner asked to close this account on {formatDate(requestedAt)}.</span>{" "}
        {overdue ? `It's been 30 days: delete it below.` : `Delete it on or after ${formatDate(due)}. Billing is set to stop at the end of the period.`}
      </p>
      <ActionButton
        action={cancelClosureAction.bind(null, slug)}
        success="Closure cancelled; their billing carries on"
        confirm={{ title: "Cancel the closure?", description: "Their account stays open and their subscription carries on renewing.", confirmLabel: "Keep it open" }}
      >
        Cancel closure
      </ActionButton>
    </div>
  );
}
