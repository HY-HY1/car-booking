import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { formatDate } from "@leadgen/core/dates";
import { daysUntilDue, isOpen, REQUEST_KINDS, REQUEST_STATUSES } from "@leadgen/core/privacy/rules";
import { closureDate } from "@leadgen/core/settings/account";
import { isCustomHostname } from "@leadgen/core/tenants";
import {
  CloseAccount,
  LogRequestForm,
  PrivacyDetailsForm,
  PrivacyExtrasForm,
  RequestCard,
  type RequestRow,
} from "@/components/dashboard/settings/privacy-forms";
import { ReadOnlyNotice, SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl, marketingUrl, tenantUrl } from "@/lib/urls";
import {
  cancelClosureAction,
  logRequest,
  requestClosureAction,
  savePrivacyExtras,
  savePrivacySettings,
  updateRequest,
} from "./actions";

export const metadata: Metadata = { title: "Privacy & data" };

type RequestData = {
  id: string;
  customer_id: string | null;
  kind: string;
  requester_name: string;
  requester_email: string | null;
  details: string | null;
  source: string;
  status: string;
  identity_checked: boolean;
  received_at: string;
  due_at: string;
  closed_at: string | null;
  outcome_notes: string | null;
};

function requestRow(slug: string, r: RequestData): RequestRow {
  const open = isOpen(r.status);
  const days = daysUntilDue(r.due_at);
  const status = REQUEST_STATUSES[r.status as keyof typeof REQUEST_STATUSES] ?? r.status;
  return {
    id: r.id,
    customerHref: r.customer_id ? appUrl(`/${slug}/customers/${r.customer_id}`) : null,
    kindLabel: REQUEST_KINDS[r.kind as keyof typeof REQUEST_KINDS] ?? r.kind,
    requesterName: r.requester_name,
    requesterEmail: r.requester_email,
    details: r.details,
    fromWebsite: r.source === "website",
    status: r.status,
    identityChecked: r.identity_checked,
    receivedLabel: formatDate(r.received_at),
    dueLabel: open
      ? days < 0
        ? `Overdue by ${-days} day${days === -1 ? "" : "s"}`
        : `Due ${formatDate(r.due_at)} (${days} day${days === 1 ? "" : "s"} left)`
      : `${status}${r.closed_at ? ` ${formatDate(r.closed_at)}` : ""}`,
    overdue: open && days < 0,
    open,
    outcomeNotes: r.outcome_notes,
  };
}

export default async function PrivacyPage({ params }: PageProps<"/app/[tenant]/settings/privacy">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const readOnly = !can("settings.edit");
  const supabase = await createClient();

  const [settings, requests, domains] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, legal_name, privacy_email, ico_registration, retention_months, terms_accepted_at, privacy_policy_url, marketing_consent_text, photo_retention_days, deletion_requested_at")
      .eq("id", tenant.id)
      .single(),
    supabase
      .from("data_requests")
      .select("id, customer_id, kind, requester_name, requester_email, details, source, status, identity_checked, received_at, due_at, closed_at, outcome_notes")
      .eq("tenant_id", tenant.id)
      .order("received_at", { ascending: false })
      .limit(100),
    // Only a domain that's live: the notice is at the address customers use.
    supabase.from("domains").select("hostname").eq("tenant_id", tenant.id).eq("is_primary", true).eq("verified", true),
  ]);
  if (settings.error) throw settings.error;
  if (requests.error) throw requests.error;

  const s = settings.data;
  const customDomain = (domains.data ?? []).map((d) => d.hostname).find(isCustomHostname) ?? null;
  const noticeUrl = tenantUrl(slug, "/privacy", { absolute: true, customDomain });
  const open = requests.data.filter((r) => isOpen(r.status));
  const done = requests.data.filter((r) => !isOpen(r.status));
  const overdue = open.filter((r) => daysUntilDue(r.due_at) < 0).length;
  const link = "underline underline-offset-4 hover:text-foreground";

  return (
    <SettingsStack>
      {readOnly && <ReadOnlyNotice />}
      <SettingsSection
        id="controller"
        title="Your privacy details"
        description={
          <>
            You&apos;re the controller of your customers&apos; data. These details go in the{" "}
            <a href={noticeUrl} target="_blank" rel="noreferrer" className={link}>
              privacy notice on your booking page
            </a>
            . Most businesses that handle customer details need to{" "}
            <a href="https://ico.org.uk/for-organisations/data-protection-fee/" target="_blank" rel="noreferrer" className={link}>
              pay the ICO data protection fee
            </a>
            .
            {s.terms_accepted_at && (
              <span className="mt-2 block">
                Terms of Service and Data Processing Terms accepted {formatDate(s.terms_accepted_at)}.{" "}
                <Link href={marketingUrl("/legal/dpa")} className={link}>
                  Read them
                </Link>
                .
              </span>
            )}
          </>
        }
      >
        <PrivacyDetailsForm
          values={s}
          businessName={tenant.name}
          action={savePrivacySettings.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="booking-page"
        title="On your booking page"
        description="Your own privacy policy, what the marketing tick box says, and how long customers' photos are kept."
      >
        <PrivacyExtrasForm
          values={{
            privacy_policy_url: s.privacy_policy_url,
            marketing_consent_text: s.marketing_consent_text,
            photo_retention_days: s.photo_retention_days,
          }}
          action={savePrivacyExtras.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="requests"
        title="Data requests"
        badge={
          open.length > 0 ? (
            <Badge tone={overdue ? "danger" : "warning"}>
              {open.length} open{overdue ? `, ${overdue} overdue` : ""}
            </Badge>
          ) : undefined
        }
        description="Customers can ask for a copy of their data, or to correct, erase or stop using it, from your booking site's privacy page. You have one month to reply. Check who's asking before you send or delete anything; open the customer to export or erase their data."
      >
        <div className="grid gap-4">
          {open.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-4 py-3 text-muted-foreground">No open requests.</p>
          ) : (
            open.map((r) => (
              <RequestCard key={r.id} r={requestRow(slug, r)} action={updateRequest.bind(null, slug, r.id)} />
            ))
          )}

          <details className="group rounded-lg border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium">Log a request you got another way</summary>
            <div className="border-t p-4">
              <LogRequestForm action={logRequest.bind(null, slug)} />
            </div>
          </details>

          {done.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex min-h-12 cursor-pointer items-center px-4 text-muted-foreground">
                {done.length} closed {done.length === 1 ? "request" : "requests"}
              </summary>
              <div className="grid gap-3 border-t p-4">
                {done.map((r) => (
                  <RequestCard key={r.id} r={requestRow(slug, r)} action={updateRequest.bind(null, slug, r.id)} />
                ))}
              </div>
            </details>
          )}
        </div>
      </SettingsSection>

      {can("data.export") && (
        <SettingsSection
          id="export"
          title="Download all your data"
          description="Everything your business holds here in one file: settings, prices, customers, enquiries, bookings and privacy records. Photos are listed, not included."
        >
          <div className="grid gap-3">
            <p className="text-muted-foreground">Keep it somewhere safe: it contains customers&apos; details.</p>
            {/* A download, not a page: a plain link so the browser saves it. */}
            <a href={appUrl(`/${slug}/settings/privacy/export`)} className={buttonVariants({ variant: "outline", size: "lg", className: "justify-self-start" })} download>
              <Download /> Download data (JSON)
            </a>
          </div>
        </SettingsSection>
      )}

      {can("account.close") && (
        <SettingsSection id="close-account" title="Delete account" description={`Close ${s.name} and delete its data for good.`}>
          <CloseAccount
            businessName={s.name}
            requestedAt={s.deletion_requested_at}
            deleteOn={s.deletion_requested_at ? formatDate(closureDate(s.deletion_requested_at).toISOString()) : null}
            requestAction={requestClosureAction.bind(null, slug)}
            cancelAction={cancelClosureAction.bind(null, slug)}
          />
        </SettingsSection>
      )}
    </SettingsStack>
  );
}
