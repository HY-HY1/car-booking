import type { Metadata } from "next";
import Link from "next/link";
import { daysUntilDue, isOpen, REQUEST_KINDS, REQUEST_STATUSES } from "@leadgen/core/privacy/rules";
import { formatDate } from "@leadgen/core/customer-fields";
import { closureDate } from "@leadgen/core/settings/account";
import { CloseAccount, PrivacyExtrasForm } from "@/components/dashboard/settings/privacy-forms";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Field, SaveForm, fieldClass } from "@/components/dashboard/form-kit";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  cancelClosureAction,
  logRequest,
  requestClosureAction,
  savePrivacyExtras,
  savePrivacySettings,
  updateRequest,
} from "./actions";
import { appUrl, marketingUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage({ params }: PageProps<"/app/[tenant]/settings/privacy">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const supabase = await createClient();

  const [settings, requests, host] = await Promise.all([
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
    supabase.from("domains").select("hostname").eq("tenant_id", tenant.id).eq("is_primary", true).maybeSingle(),
  ]);
  if (settings.error) throw settings.error;
  if (requests.error) throw requests.error;

  const s = settings.data;
  const open = requests.data.filter((r) => isOpen(r.status));
  const done = requests.data.filter((r) => !isOpen(r.status));
  const isOwner = can("settings.edit");

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Your privacy details</CardTitle>
          <CardDescription>
            You are the controller of your customers&apos; data. These details appear in the privacy notice
            on your booking page{host.data ? ` (${host.data.hostname}/privacy)` : ""}. If you trade as a
            business, use its registered name. Most businesses that handle customer details need to{" "}
            <a href="https://ico.org.uk/for-organisations/data-protection-fee/" className="underline">
              pay the ICO data protection fee
            </a>{" "}
            and put the registration number below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaveForm action={savePrivacySettings.bind(null, slug)} readOnly={!isOwner}>
            {(errors) => (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Legal or trading name" name="legalName" error={errors.legalName}>
                    <Input name="legalName" defaultValue={s.legal_name ?? ""} placeholder={tenant.name} />
                  </Field>
                  <Field label="Privacy contact email" name="privacyEmail" error={errors.privacyEmail}>
                    <Input name="privacyEmail" type="email" defaultValue={s.privacy_email ?? ""} />
                  </Field>
                  <Field label="ICO registration number" name="icoRegistration" error={errors.icoRegistration}>
                    <Input name="icoRegistration" defaultValue={s.ico_registration ?? ""} placeholder="ZA123456" />
                  </Field>
                  <Field label="Keep customer details for (months)" name="retentionMonths" error={errors.retentionMonths}>
                    <Input name="retentionMonths" type="number" min={12} max={84} defaultValue={s.retention_months} />
                  </Field>
                </div>
                <p className="text-sm text-muted-foreground">
                  After this long with no enquiry or booking, a customer&apos;s name, contact details,
                  address, vehicles and photos are erased automatically. Their past jobs stay in your
                  records, without their details, for your accounts.
                </p>
              </>
            )}
          </SaveForm>
          {s.terms_accepted_at && (
            <p className="mt-4 text-xs text-muted-foreground">
              Terms of Service and Data Processing Terms accepted {formatDate(s.terms_accepted_at)}.{" "}
              <Link href={marketingUrl("/legal/dpa")} className="underline">Read them</Link>.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>On your booking page</CardTitle>
          <CardDescription>Your privacy policy link, what the marketing tick box says, and how long photos are kept.</CardDescription>
        </CardHeader>
        <CardContent>
          <PrivacyExtrasForm
            values={{
              privacy_policy_url: s.privacy_policy_url,
              marketing_consent_text: s.marketing_consent_text,
              photo_retention_days: s.photo_retention_days,
            }}
            action={savePrivacyExtras.bind(null, slug)}
            readOnly={!isOwner}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data requests</CardTitle>
          <CardDescription>
            Customers can ask for a copy of their data, or to correct, erase or stop using it, from the
            Privacy page on your booking site. You have one month to reply. Check who is asking before you
            send or delete anything. Open the customer to export their data or erase it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {open.length === 0 && <p className="text-muted-foreground">No open requests.</p>}
          {open.map((r) => (
            <RequestCard key={r.id} slug={slug} r={r} />
          ))}

          <details className="rounded-xl border bg-card">
            <summary className="cursor-pointer px-4 py-3 font-medium">Log a request you received another way</summary>
            <div className="border-t px-4 py-4">
              <SaveForm action={logRequest.bind(null, slug)} resetOnSave submitLabel="Log request">
                {(errors) => (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Type" name="kind" error={errors.kind}>
                      <select name="kind" defaultValue="" className={fieldClass + " h-8"}>
                        <option value="" disabled>Choose…</option>
                        {Object.entries(REQUEST_KINDS).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Their name" name="name" error={errors.name}>
                      <Input name="name" />
                    </Field>
                    <Field label="Their email (matches them to a customer)" name="email" error={errors.email}>
                      <Input name="email" type="email" />
                    </Field>
                    <Field label="Details" name="details" error={errors.details}>
                      <textarea name="details" rows={2} className={fieldClass} />
                    </Field>
                  </div>
                )}
              </SaveForm>
            </div>
          </details>

          {done.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">{done.length} closed</summary>
              <div className="mt-3 grid gap-3">
                {done.map((r) => (
                  <RequestCard key={r.id} slug={slug} r={r} />
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {can("data.export") && (
        <Card>
          <CardHeader>
            <CardTitle>Download all your data</CardTitle>
            <CardDescription>
              Everything your business holds here in one file: settings, prices, customers, enquiries, bookings and
              privacy records. Photos are listed, not included. Keep it somewhere safe: it contains customers&apos; details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* A download, not a page: a plain link so the browser saves it. */}
            <a href={appUrl(`/${slug}/settings/privacy/export`)} className={buttonVariants({ variant: "outline" })} download>
              Download data (JSON)
            </a>
          </CardContent>
        </Card>
      )}

      {can("account.close") && (
        <Card id="close-account">
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>Close {s.name} and delete its data for good.</CardDescription>
          </CardHeader>
          <CardContent>
            <CloseAccount
              businessName={s.name}
              requestedAt={s.deletion_requested_at}
              deleteOn={s.deletion_requested_at ? formatDate(closureDate(s.deletion_requested_at).toISOString()) : null}
              requestAction={requestClosureAction.bind(null, slug)}
              cancelAction={cancelClosureAction.bind(null, slug)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type RequestRow = {
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

function RequestCard({ slug, r }: { slug: string; r: RequestRow }) {
  const days = daysUntilDue(r.due_at);
  const open = isOpen(r.status);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {REQUEST_KINDS[r.kind as keyof typeof REQUEST_KINDS] ?? r.kind}
          <span className="font-normal text-muted-foreground">
            {" "}· {r.requester_name}
            {r.requester_email && ` (${r.requester_email})`}
          </span>
        </p>
        <p className={open && days < 0 ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>
          {open
            ? days < 0
              ? `Overdue by ${-days} day${days === -1 ? "" : "s"}`
              : `Due ${formatDate(r.due_at)} (${days} day${days === 1 ? "" : "s"} left)`
            : `${REQUEST_STATUSES[r.status as keyof typeof REQUEST_STATUSES]} ${r.closed_at ? formatDate(r.closed_at) : ""}`}
        </p>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Received {formatDate(r.received_at)} ({r.source === "website" ? "privacy page" : "logged by you"})
        {r.customer_id ? (
          <>
            {" · "}
            <Link href={appUrl(`/${slug}/customers/${r.customer_id}`)} className="underline">
              Matching customer
            </Link>
          </>
        ) : (
          " · No customer matched that email"
        )}
      </p>
      {r.details && <p className="mb-3 whitespace-pre-line text-sm">{r.details}</p>}
      <SaveForm action={updateRequest.bind(null, slug, r.id)}>
        {() => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status" name="status">
              <select name="status" defaultValue={r.status} className={fieldClass + " h-8"}>
                {Object.entries(REQUEST_STATUSES).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-end pb-1.5">
              <Check name="identity_checked" label="I've checked who they are" defaultChecked={r.identity_checked} />
            </div>
            <Field label="What you did" name="outcome_notes" className="sm:col-span-2">
              <textarea name="outcome_notes" rows={2} defaultValue={r.outcome_notes ?? ""} className={fieldClass} />
            </Field>
          </div>
        )}
      </SaveForm>
    </div>
  );
}
