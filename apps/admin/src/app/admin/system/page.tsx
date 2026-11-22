import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleAlert, CircleCheck, CircleMinus } from "lucide-react";
import { formatDateTime } from "@leadgen/core/dates";
import { envChecks, migrationChecks, recentFailures, stripeMode, type Failure } from "@leadgen/core/platform/system";
import { routingConfig } from "@leadgen/core/urls";
import { Panel } from "@/components/dashboard/overview/panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePlatformAdmin } from "@/lib/platform";
import { ago } from "@/lib/platform-format";
import { adminUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "System" };

export default function SystemPage() {
  return (
    <>
      <PageHeader title="System" description="Settings, database migrations, and what's been failing in the last week." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Checking…</p>}>
        <System />
      </Suspense>
    </>
  );
}

async function System() {
  await requirePlatformAdmin(adminUrl("/system"));
  const [migrations, failures] = await Promise.all([migrationChecks(), recentFailures()]);
  const env = envChecks();
  const missingRequired = env.flatMap((g) => g.checks).filter((c) => c.required && !c.set);
  const unapplied = migrations.filter((m) => !m.applied);
  const mode = stripeMode();
  const routing = routingConfig();

  return (
    <div className="grid gap-6">
      <section aria-label="Summary" className="flex flex-wrap gap-2">
        <Badge tone={mode === "live" ? "success" : mode === "test" ? "warning" : "danger"}>
          Stripe: {mode === "live" ? "live mode" : mode === "test" ? "test mode" : "not set up"}
        </Badge>
        <Badge>Addresses: {routing.mode} mode</Badge>
        <Badge tone={unapplied.length ? "danger" : "success"}>
          {unapplied.length ? `${unapplied.length} ${unapplied.length === 1 ? "migration" : "migrations"} not run` : "Database up to date"}
        </Badge>
        <Badge tone={missingRequired.length ? "danger" : "success"}>
          {missingRequired.length ? `${missingRequired.length} required ${missingRequired.length === 1 ? "setting" : "settings"} missing` : "Required settings in place"}
        </Badge>
        <Badge tone={failures.lastStripeEventAt ? "neutral" : "warning"}>
          Last Stripe webhook: {failures.lastStripeEventAt ? ago(failures.lastStripeEventAt) : "none received"}
        </Badge>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-1 font-medium">Database migrations</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            The recent ones, checked by looking for something each adds. Run a missing one in the Supabase SQL editor, oldest first, from
            supabase/migrations.
          </p>
          <ul className="grid gap-1.5 text-sm">
            {migrations.map((m) => (
              <li key={m.file} className="flex items-center gap-2">
                {m.applied ? <CircleCheck className="size-4 shrink-0 text-emerald-600" /> : <CircleAlert className="size-4 shrink-0 text-destructive" />}
                <span className={`font-mono text-xs ${m.applied ? "text-muted-foreground" : "font-medium"}`}>{m.file}.sql</span>
                {!m.applied && <Badge tone="danger">Not run</Badge>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <h2 className="mb-1 font-medium">Problems this week</h2>
          <ul className="mt-3 grid gap-1.5 text-sm">
            <Count n={failures.emails.length} label="emails failed, bounced or reported as spam" cap={25} />
            <Count n={failures.stuckEmails} label="emails stuck sending for over an hour" />
            <Count n={failures.deliveries.length} label="webhook deliveries given up on" cap={25} />
            <Count n={failures.calendars.length} label="Google Calendars needing reconnecting" />
          </ul>
        </Panel>
      </div>

      <Panel>
        <h2 className="mb-1 font-medium">Settings</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Environment variables this app can see (the booking app has its own copy on Vercel). Values are never shown.
        </p>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {env.map((g) => (
            <div key={g.title}>
              <h3 className="mb-1.5 text-sm font-medium">{g.title}</h3>
              <ul className="grid gap-1 text-sm">
                {g.checks.map((c) => (
                  <li key={c.name} className="flex items-start gap-2">
                    {c.set ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    ) : c.required ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <CircleMinus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-mono text-xs break-all">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.does}
                        {!c.set && (c.required ? " · missing" : " · optional, not set")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <FailureList title="Emails that didn't arrive" rows={failures.emails} empty="No failed emails this week." />
      <FailureList title="Webhook deliveries given up on" rows={failures.deliveries} empty="No failed webhook deliveries this week." />
      {failures.calendars.length > 0 && <FailureList title="Google Calendars needing reconnecting" rows={failures.calendars} empty="" />}
    </div>
  );
}

function Count({ n, label, cap }: { n: number; label: string; cap?: number }) {
  return (
    <li className="flex items-center gap-2">
      {n === 0 ? <CircleCheck className="size-4 shrink-0 text-emerald-600" /> : <CircleAlert className="size-4 shrink-0 text-amber-600" />}
      <span>
        <span className="font-medium tabular-nums">{cap && n >= cap ? `${cap}+` : n}</span> {label}
      </span>
    </li>
  );
}

function FailureList({ title, rows, empty }: { title: string; rows: Failure[]; empty: string }) {
  return (
    <Panel>
      <h2 className="mb-3 font-medium">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState compact>{empty}</EmptyState>
      ) : (
        <ul className="divide-y">
          {rows.map((f) => (
            <li key={f.id} className="grid gap-0.5 py-2 text-sm first:pt-0 last:pb-0">
              <span className="first-letter:uppercase">{f.what}</span>
              {f.detail && <span className="text-xs break-words text-muted-foreground">{f.detail}</span>}
              <span className="text-xs text-muted-foreground">
                {formatDateTime(f.at)}
                {f.tenant && (
                  <>
                    {" · "}
                    <Link href={adminUrl(`/businesses/${f.tenant.slug}`)} className="underline-offset-4 hover:underline">
                      {f.tenant.name}
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
