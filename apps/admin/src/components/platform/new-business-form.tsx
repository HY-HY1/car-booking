"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { HOURS_PRESETS, slugify } from "@leadgen/core/platform/rules";
import { createBusinessAction, type NewBusinessState } from "@/app/admin/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CopyText } from "./copy-text";
import { Field, selectClass } from "./field";
import { adminUrl, tenantUrl } from "@/lib/urls";

export function NewBusinessForm() {
  const [state, formAction, pending] = useActionState<NewBusinessState, FormData>(createBusinessAction, {});
  const [name, setName] = useState("");
  const v = state.values ?? {};
  const e = state.errors ?? {};

  if (state.created) return <Created created={state.created} />;

  return (
    <form action={formAction} className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>The business</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Business name" name="name" error={e.name}>
            <Input id="name" name="name" defaultValue={v.name} required onChange={(ev) => setName(ev.target.value)} />
          </Field>
          <Field
            label="Dashboard ID"
            name="slug"
            error={e.slug}
            hint={`Used in the dashboard address. Leave blank to use "${slugify(name) || "…"}".`}
          >
            <Input id="slug" name="slug" defaultValue={v.slug} placeholder={slugify(name)} autoCapitalize="none" />
          </Field>
          <Field
            label="Owner's email"
            name="ownerEmail"
            error={e.ownerEmail}
            hint="Their login. If they have no account yet, one is created with a temporary password shown on the next screen."
          >
            <Input id="ownerEmail" name="ownerEmail" type="email" defaultValue={v.ownerEmail} required />
          </Field>
          <Field
            label="Their own domain (optional)"
            name="hostname"
            error={e.hostname}
            hint="If they already have one for booking, e.g. bookings.theirsite.co.uk. Their booking page works at its free address either way."
          >
            <Input id="hostname" name="hostname" defaultValue={v.hostname} placeholder="bookings.theirsite.co.uk" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Look and feel</CardTitle>
          <CardDescription>The owner can change these later.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Main colour" name="primaryColor" error={e.primaryColor}>
            <Input id="primaryColor" name="primaryColor" type="color" defaultValue={v.primaryColor ?? "#18181b"} className="h-9 p-1" />
          </Field>
          <Field label="Accent colour" name="accentColor" error={e.accentColor}>
            <Input id="accentColor" name="accentColor" type="color" defaultValue={v.accentColor ?? "#3b82f6"} className="h-9 p-1" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Tagline (optional)" name="tagline" error={e.tagline}>
              <Input id="tagline" name="tagline" defaultValue={v.tagline} placeholder="Mobile detailing that comes to you" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking starting point</CardTitle>
          <CardDescription>Sensible defaults to get the booking page working. The owner refines them in the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Opening hours" name="hours" error={e.hours}>
              <select id="hours" name="hours" defaultValue={v.hours ?? "weekdays"} className={selectClass}>
                {Object.entries(HOURS_PRESETS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Base postcode (optional)" name="basePostcode" error={e.basePostcode} hint="Where the van starts from.">
            <Input id="basePostcode" name="basePostcode" defaultValue={v.basePostcode} autoCapitalize="characters" />
          </Field>
          <Field label="Service radius, miles (optional)" name="radiusMiles" error={e.radiusMiles} hint="Needs a base postcode. Blank = anywhere.">
            <Input id="radiusMiles" name="radiusMiles" inputMode="numeric" defaultValue={v.radiusMiles} />
          </Field>
          <Field label="Deposit (% of the price)" name="depositPercent" error={e.depositPercent} hint="0 for no deposit.">
            <Input id="depositPercent" name="depositPercent" inputMode="decimal" defaultValue={v.depositPercent ?? "25"} />
          </Field>
          <div className="grid content-start gap-3 text-sm sm:pt-6">
            <label className="flex items-start gap-2">
              <input type="checkbox" name="starterServices" defaultChecked={state.values ? v.starterServices === "on" : true} className="mt-0.5 size-4" />
              <span>Add placeholder services (a wash and a full valet) so the page isn&apos;t empty</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="addMe" defaultChecked={state.values ? v.addMe === "on" : true} className="mt-0.5 size-4" />
              <span>Add me as an owner too, so I can open their dashboard</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating…" : "Create business"}
        </Button>
        <Link href={adminUrl()} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Created({ created }: { created: NonNullable<NewBusinessState["created"]> }) {
  const url = tenantUrl(created.slug, "/", { absolute: true });

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{created.name} is set up</CardTitle>
        <CardDescription>Share these with the owner. The password is only shown now.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 text-sm">
        <div className="grid gap-2">
          <p className="font-medium">Owner login</p>
          <CopyText value={created.ownerEmail} label="email" />
          {created.ownerTempPassword ? (
            <>
              <CopyText value={created.ownerTempPassword} label="temporary password" />
              <p className="text-xs text-muted-foreground">
                Ask them to change it under Change password after signing in. It can&apos;t be shown again.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">They already had an account, so their password is unchanged.</p>
          )}
        </div>

        <div className="grid gap-2">
          <p className="font-medium">Booking page</p>
          <CopyText value={url} label="booking address" />
          {created.hostname && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {created.hostname} isn&apos;t live yet. Point its DNS at us, add the domain to the project&apos;s
              hosting, then mark it verified on the business page. Until then customers use the address above.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <p className="font-medium">Next</p>
          <ol className="list-decimal pl-5 text-muted-foreground">
            <li>The owner signs in and edits services and prices under Pricing.</li>
            <li>They connect Stripe under Settings → Payments to take deposits.</li>
            <li>Add the booking script to their website (shown on the business page).</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Link href={adminUrl(`/${created.slug}`)} className={buttonVariants()}>
            Open business
          </Link>
          <Link href={adminUrl("/new")} className={buttonVariants({ variant: "outline" })} prefetch={false}>
            Add another
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
