# Stripe Integration — Deposits & Payments

_Checked against Stripe's docs on 13 October 2026. Stripe's Connect APIs are changing (Accounts v2 is in preview), so re-check the linked pages before you build each part._

## The model in one paragraph

Each detailer has **their own Stripe account**, connected to your platform through **Stripe Connect**. Deposits are **direct charges**: the customer pays the detailer's account, the detailer pays Stripe's fees, and the detailer handles any disputes. Your platform creates the Checkout page, listens to webhooks, and can optionally take an **application fee** per booking. You never hold customer money.

This is Stripe's **"Stripe-owned pricing"** SaaS model. Connected accounts are the merchant of record, pay Stripe's fees, carry their own negative balances, and take payments as direct charges. Stripe doesn't charge your platform in this model.

```
Customer ──£29 deposit──▶ Detailer's Stripe account ──payout──▶ Detailer's bank
                              │
                              ├── Stripe fee (paid by detailer)
                              └── optional application fee ──▶ Your platform account
```

---

## 1. Platform setup (once)

1. Create your Stripe account and **register as a Connect platform** in the Dashboard.
2. Complete your platform profile and Connect branding (name, icon, colour). Detailers see this during onboarding.
3. In Connect settings, enable the **payment methods** connected accounts can use (cards, Apple Pay, Google Pay).
4. Get your keys: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
5. Install: `pnpm add stripe` (server) and, if you embed Checkout, `pnpm add @stripe/stripe-js @stripe/react-stripe-js`.

```ts
// packages/core/stripe/client.ts
import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

---

## 2. Connecting a detailer (onboarding)

### Which API version

Stripe's SaaS guide now uses **Accounts v2** for new platforms; the v1 guide is marked for existing platforms. Accounts v2 requests currently send a **preview** `Stripe-Version` header. Use v2 as Stripe recommends, but keep the code in one file so it's easy to update when it leaves preview.

### Create the connected account

Create it when the owner clicks **Connect Stripe** in Settings → Payments.

The settings that make this the right model:

| Setting | Value | Meaning |
| --- | --- | --- |
| `dashboard` | `full` | Detailer gets the full Stripe Dashboard (needed for direct charges) |
| `defaults.responsibilities.fees_collector` | `stripe` | Stripe collects processing fees from the detailer |
| `defaults.responsibilities.losses_collector` | `stripe` | Stripe, not you, is liable for the detailer's negative balances |
| `configuration.merchant.capabilities.card_payments.requested` | `true` | Lets them take card payments (minimum required) |

Stripe recommends direct charges for connected accounts with access to the full Stripe Dashboard, which is why `dashboard: "full"`.

```ts
// packages/core/stripe/accounts.ts
const STRIPE_V2_VERSION = "2026-09-30.preview"; // check the current value in Stripe's docs

async function stripeV2(path: string, body: unknown) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Stripe-Version": STRIPE_V2_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Stripe ${path} failed: ${await res.text()}`);
  return res.json();
}

export async function createConnectedAccount(tenant: {
  id: string; name: string; ownerEmail: string;
}) {
  const account = await stripeV2("/v2/core/accounts", {
    contact_email: tenant.ownerEmail,
    display_name: tenant.name,
    dashboard: "full",
    identity: { country: "gb" },
    configuration: {
      merchant: { capabilities: { card_payments: { requested: true } } },
    },
    defaults: {
      currency: "gbp",
      responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
      locales: ["en-GB"],
    },
    metadata: { tenant_id: tenant.id },
    include: ["configuration.merchant", "requirements"],
  });
  return account.id as string; // save to tenants.stripe_account_id
}
```

> If your version of `stripe-node` exposes `stripe.v2.core.accounts.create(...)`, use that instead of the `fetch` helper. The request body is the same.

### Send them through Stripe-hosted onboarding

```ts
export async function createOnboardingLink(accountId: string) {
  const link = await stripeV2("/v2/core/account_links", {
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant"],
        collection_options: { fields: "eventually_due" }, // collect everything up front
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?stripe=return`,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/onboarding-link`,
      },
    },
  });
  return link.url as string; // redirect the signed-in owner here
}
```

Rules from Stripe's docs:

- Each link works **once** and expires after a few minutes. Generate it on click; never email or text it.
- `refresh_url` should create a fresh link and redirect again (expired, reused, or a messaging app previewed it).
- Arriving at `return_url` **doesn't** mean onboarding is finished. Re-check the account's requirements.
- Stripe-hosted onboarding works only in a normal browser, so it's fine for your admin app.

### Know when they can take payments

- Listen for the **`v2.core.account[requirements].updated`** event (Accounts v2 replaces the v1 `account.updated` event for this).
- On each event, retrieve the account, check outstanding requirements and whether card payments are active, and store the result as `tenants.stripe_ready`.
- If `stripe_ready` is false, the booking panel **doesn't offer a deposit step**. Either take the booking without one, or hide booking until Stripe is connected (a tenant setting).

---

## 3. Taking the deposit

### Flow

```
Agent: hold_slot ──▶ booking row (status = held, expires_at)
Agent: create_checkout ──▶ Checkout Session on the detailer's account
Customer pays on Stripe's page
Webhook: checkout.session.completed ──▶ booking confirmed
         (email, owner alert, calendar event, conversion)
```

### Create the Checkout Session (the `create_checkout` tool)

```ts
// packages/core/stripe/checkout.ts
export async function createDepositCheckout(booking: {
  id: string; tenantId: string; leadId: string;
  stripeAccountId: string;
  depositPence: number;           // from quote_snapshot, never from the client or the model
  description: string;            // e.g. "Deposit: Full valet, Large/SUV, Sat 18 Oct 10:00"
  customerEmail: string;
  bookingHost: string;            // tenant hostname, e.g. bookings.ascnd.co.uk
  platformFeePence?: number;      // optional application fee
}) {
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: booking.customerEmail,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: booking.depositPence,
          product_data: { name: booking.description },
        },
      }],
      payment_intent_data: {
        ...(booking.platformFeePence
          ? { application_fee_amount: booking.platformFeePence }
          : {}),
        metadata: { tenant_id: booking.tenantId, booking_id: booking.id },
      },
      metadata: {
        tenant_id: booking.tenantId,
        booking_id: booking.id,
        lead_id: booking.leadId,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // see "Holds and expiry" below
      success_url: `https://${booking.bookingHost}/confirmed/${booking.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${booking.bookingHost}/?resume=${booking.id}`,
    },
    {
      stripeAccount: booking.stripeAccountId, // makes it a direct charge
      idempotencyKey: `checkout-${booking.id}`, // safe if the agent retries
    },
  );

  // save session.id on the booking, then return session.url to the Confirm button
  return session.url!;
}
```

Notes:

- The `stripeAccount` option sends the `Stripe-Account` header, which makes this a direct charge on the detailer's account. Checkout uses **the detailer's** Stripe branding, so customers feel they're paying the business, not your platform.
- **Amounts are in pence.** Calculate the deposit on the server from `quote_snapshot`. Never trust an amount from the browser or from the model.
- `application_fee_amount` is optional. It must be positive and less than the charge, and Stripe charges no extra fee on the application fee itself.
- Embedded Checkout (`ui_mode: "embedded_page"`) keeps the payment inside your quote panel. Stripe warns against placing Checkout inside another iframe, though, and your panel is already an iframe on the detailer's site. Use the **redirect** version from the embed and open it in the top window.

### Holds and expiry

Stripe requires a Checkout Session to stay open for **at least 30 minutes** (`expires_at` can't be sooner). Two options:

1. **Make the slot hold 30 minutes** to match. This is the simplest option and is what the code above assumes.
2. Keep a 15-minute hold, and when it lapses call `stripe.checkout.sessions.expire(sessionId, { stripeAccount })` from the jobs runner.

Either way, handle the race where a payment lands just after the hold expired (see the webhook below).

---

## 4. Webhooks

You need two endpoints in `apps/booking`:

| Endpoint | Receives | Configure in Stripe as |
| --- | --- | --- |
| `/api/webhooks/stripe` | Events on **connected accounts**: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created` | A webhook endpoint listening to **events on connected accounts** |
| `/api/webhooks/stripe-accounts` | `v2.core.account[requirements].updated` | An **event destination** for Accounts v2 events |

Stripe's guidance: rely on webhooks, not the success-page redirect. The customer can close the tab before the redirect happens, and some payment methods confirm days later.

```ts
// apps/booking/app/api/webhooks/stripe/route.ts
import { stripe } from "@core/stripe/client";
import { db } from "@core/db";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text(); // raw body is required for signature checks

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  // Idempotency: Stripe can deliver the same event more than once
  const firstTime = await db.recordStripeEvent(event.id); // insert into stripe_events; false if it already exists
  if (!firstTime) return new Response("ok");

  const connectedAccount = event.account; // the detailer's account ID

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.payment_status !== "paid") break; // async methods: wait for async_payment_succeeded
      await confirmBooking({
        bookingId: s.metadata!.booking_id,
        tenantId: s.metadata!.tenant_id,
        stripeAccount: connectedAccount!,
        paymentIntentId: s.payment_intent as string,
        amountPaid: s.amount_total!,
      });
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await releaseHold(event.data.object.metadata!.booking_id);
      break;
    case "charge.refunded":
      await markDepositRefunded(event.data.object.payment_intent as string);
      break;
    case "charge.dispute.created":
      await alertOwnerOfDispute(connectedAccount!, event.data.object);
      break;
  }
  return new Response("ok");
}
```

### `confirmBooking` must handle the late-payment race

```ts
async function confirmBooking(p: { bookingId: string; tenantId: string; stripeAccount: string;
  paymentIntentId: string; amountPaid: number }) {
  // 1. Check tenant_id matches the booking AND the tenant's stripe_account_id matches p.stripeAccount
  // 2. Try: update bookings set status='confirmed', deposit_status='paid', ...
  //         where id = p.bookingId and status in ('held', 'expired')
  //    The exclusion constraint / capacity check rejects it if someone else took the slot.
  // 3. If the slot is gone: refund automatically, email an apology with fresh slots, alert the owner.
  // 4. If confirmed: set lead won_by, send the confirmation email, alert the owner,
  //    add the Google Calendar event, schedule the reminder, fire the tracking conversion.
}
```

---

## 5. Refunds

Done from the owner's Booking detail page, inside the tenant's refund cut-off:

```ts
await stripe.refunds.create(
  {
    payment_intent: booking.stripePaymentIntentId,
    // amount: 1000,                // optional partial refund in pence
    refund_application_fee: true,   // otherwise the detailer loses your fee too
  },
  { stripeAccount: tenant.stripeAccountId },
);
```

Application fees **aren't** refunded automatically on direct charges. Pass `refund_application_fee: true` or the detailer loses that amount. On a partial refund, a proportional share of the fee is refunded.

Stripe doesn't return its own processing fee on refunds, so show the owner "You'll get back £X" before they confirm.

---

## 6. Disputes

With direct charges, **the connected account (the detailer) handles disputes**, not your platform. Your job:

- Alert the owner on `charge.dispute.created`.
- Make evidence easy to find: the booking detail page already has the photos, transcript, confirmation email and timestamps. Add a "Download evidence" button that bundles them.

---

## 7. Optional extras

### Card on file instead of a deposit

For tenants who prefer no upfront charge:

1. Checkout with `mode: "setup"` on the connected account saves the card without charging it.
2. On a no-show, create a PaymentIntent on the connected account for the no-show fee with `off_session: true` and `confirm: true`, using the saved payment method.
3. The customer must clearly agree to this at booking ("We'll save your card and charge £X only if you miss the appointment").

### Balance on the day

- **MVP:** the detailer takes the balance however they already do (cash, transfer, card reader).
- **Later:** a "Request balance" button creates a Checkout Session for the remaining amount on the connected account and emails or texts the link.

### Your platform fee

Pick one when you decide pricing:

- `application_fee_amount` per booking (a fixed fee or a percentage of the deposit), or
- a monthly subscription billed separately to each detailer (Stripe Billing on your own platform account).

---

## 8. Data model additions

```sql
alter table tenants add column stripe_account_id text unique;
alter table tenants add column stripe_ready boolean not null default false;

alter table bookings add column deposit_pence integer;
alter table bookings add column platform_fee_pence integer;
alter table bookings add column stripe_checkout_session_id text unique;
alter table bookings add column stripe_payment_intent_id text unique;
-- deposit_status: none | pending | paid | refunded | partially_refunded | disputed

create table stripe_events (
  id text primary key,                -- Stripe event ID; insert fails on duplicates
  type text not null,
  account text,
  received_at timestamptz not null default now()
);
```

---

## 9. Local testing

```bash
# Forward connected-account events to your local endpoint
stripe listen \
  --forward-connect-to localhost:3000/api/webhooks/stripe

# Copy the printed signing secret into STRIPE_WEBHOOK_SECRET
```

Test cards (any future expiry, any CVC):

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Declined (insufficient funds) |

Test these scenarios before going live:

- [ ] Onboard a test connected account and see `stripe_ready` flip to true
- [ ] Deposit paid → booking confirmed, emails sent, calendar event created
- [ ] Customer closes the tab after paying → webhook still confirms
- [ ] Session expires unpaid → hold released
- [ ] Payment arrives after the hold expired and the slot was taken → automatic refund and apology
- [ ] Same webhook delivered twice → handled once
- [ ] Full and partial refund from the dashboard, with and without an application fee
- [ ] A tenant without Stripe connected → booking flow skips the deposit step
- [ ] Live mode: all `return_url`, `refresh_url` and webhook URLs are HTTPS

---

## Sources

- [Stripe: Build a SaaS platform (pricing models)](https:/zdocs.stripe.com/connect/saas)
- [Stripe: Create a connected account (Accounts v2)](https://docs.stripe.com/connect/saas/tasks/create)
- [Stripe: Onboard your connected account](https://docs.stripe.com/connect/saas/tasks/onboard)
- [Stripe: Create direct charges](https://docs.stripe.com/connect/direct-charges?platform=web&ui=stripe-hosted)
- [Stripe: Build a SaaS platform with Accounts v1](https://docs.stripe.com/connect/end-to-end-saas-platform?platform=web)