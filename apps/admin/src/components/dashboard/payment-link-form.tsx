"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { createLinkAction, deactivateLinkAction, emailLinkAction, type CreateLinkState, type EmailLinkState } from "@/app/app/[tenant]/payments/links/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { formatPence } from "@leadgen/core/booking/config";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { useUnsavedChanges } from "./unsaved-changes";

export type BookingChoice = { id: string; label: string; balancePence: number; description: string; customerEmail: string | null };

export function PaymentLinkForm({ slug, bookings }: { slug: string; bookings: BookingChoice[] }) {
  const [state, formAction, pending] = useActionState<CreateLinkState, FormData>(createLinkAction.bind(null, slug), {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const form = useRef<HTMLFormElement>(null);
  const markSaved = useUnsavedChanges(form);
  useEffect(() => {
    if (state.created) markSaved();
  }, [state, markSaved]);
  // Picking a booking fills in what's still owed; both can still be edited.
  const [description, setDescription] = useState(v.description ?? "");
  const [amount, setAmount] = useState(v.amount ?? "");
  const [bookingId, setBookingId] = useState(v.bookingId ?? "");
  const customerEmail = bookings.find((b) => b.id === bookingId)?.customerEmail ?? "";

  return (
    <div className="grid max-w-xl gap-4">
      <form ref={form} action={formAction} className="grid gap-4 rounded-xl border p-4">
        {bookings.length > 0 && (
          <Field label="For a booking (optional)" name="bookingId" hint="Fills in the balance still owed. You can change it.">
            <Select
              id="bookingId"
              name="bookingId"
              defaultValue={v.bookingId ?? ""}
              onChange={(ev) => {
                setBookingId(ev.target.value);
                const b = bookings.find((x) => x.id === ev.target.value);
                if (!b) return;
                setDescription(b.description);
                setAmount((b.balancePence / 100).toFixed(2));
              }}
            >
              <option value="">Not tied to a booking</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} · {formatPence(b.balancePence)} due
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="What is it for?" name="description" error={e.description} hint="Shown to the customer on the payment page.">
          <Input id="description" name="description" value={description} onChange={(ev) => setDescription(ev.target.value)} required />
        </Field>
        <Field label="Amount" name="amount" error={e.amount}>
          <MoneyInput id="amount" name="amount" inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} required className="w-40" />
        </Field>
        <Checkbox name="singleUse" defaultChecked={state.values ? v.singleUse === "on" : true}>
          <span>
            One-off: stops working after one payment. Untick for a link you can use again, like a standard top-up.
          </span>
        </Checkbox>
        {state.message && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} className="w-fit">
          {pending ? "Creating…" : "Create payment link"}
        </Button>
      </form>

      {state.created && (
        <div className="grid gap-2 rounded-xl border p-4 text-sm">
          <p className="font-medium">
            Link created: {state.created.description}, {formatPence(state.created.amountPence)}
          </p>
          <CopyText value={state.created.url} label="payment link" />
          <p className="text-xs text-muted-foreground">
            Copy it into a message, or email it from here. {state.created.singleUse ? "It works for one payment." : "It can be paid more than once."}
          </p>
          <EmailLinkForm key={state.created.id} slug={slug} id={state.created.id} defaultEmail={customerEmail} />
        </div>
      )}
    </div>
  );
}

export function DeactivateLink({ slug, id }: { slug: string; id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="text-right">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { message } = await deactivateLinkAction(slug, id);
            if (message) toast.error(message);
            else toast.success("Payment link switched off");
          })
        }
      >
        {pending ? "Switching off…" : "Switch off"}
      </Button>
    </div>
  );
}

// Emails a link to the address given. Pressing it again sends it again.
export function EmailLinkForm({ slug, id, defaultEmail = "" }: { slug: string; id: string; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState<EmailLinkState, FormData>(async (prev, formData) => {
    const next = await emailLinkAction(slug, id, prev, formData);
    if (next.error) toast.error(next.error);
    else if (next.sentTo) toast.success(`Payment link emailed to ${next.sentTo}`);
    return next;
  }, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1">
        <Field label="Email it to" name={`to-${id}`}>
          <Input id={`to-${id}`} name="to" type="email" defaultValue={defaultEmail} placeholder="customer@example.com" required />
        </Field>
      </div>
      <Button type="submit" size="lg" variant="outline" disabled={pending}>
        <Mail />
        {pending ? "Sending…" : state.sentTo ? "Send again" : "Send"}
      </Button>
    </form>
  );
}

// A link in the list: its email form opens on demand.
export function EmailLinkToggle({ slug, id, defaultEmail }: { slug: string; id: string; defaultEmail?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Mail />
        Email
      </Button>
    );
  }
  return <EmailLinkForm slug={slug} id={id} defaultEmail={defaultEmail} />;
}
