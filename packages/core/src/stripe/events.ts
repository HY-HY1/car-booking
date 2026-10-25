import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "../supabase/admin";
import { syncAccountStatus } from "./accounts";
import { raiseAlert } from "./alerts";
import { recordPaidSession, recordRefund } from "./ledger";
import { confirmPaidBooking, releaseHold, setDepositStatus, tenantIdForAccount } from "./payments";
import { depositStatusAfterRefund } from "./rules";

// What each webhook event does (info/stripe.md, section 4). The route handlers
// verify the signature and call these; nothing here trusts a browser redirect.

// Stripe can deliver an event more than once. Claiming the id first lets only
// one delivery do the work. If the work fails the claim is dropped, so
// Stripe's retry gets another go instead of being skipped as a duplicate.
export async function claimEvent(event: { id: string; type: string; account?: string | null }) {
  const { error } = await createAdminClient()
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, account: event.account ?? null });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

export async function releaseEventClaim(id: string) {
  await createAdminClient().from("stripe_events").delete().eq("id", id);
}

// The payments ledger is a copy that a booking page can rebuild from Stripe,
// so a failure to write it must never fail the work that matters (confirming
// a booking): it's logged and left for the page to fill in.
async function bestEffort(what: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    console.error(`Stripe webhook: couldn't ${what}`, error);
  }
}

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

// Events on connected accounts (direct charges).
export async function handleConnectEvent(event: Stripe.Event) {
  const accountId = event.account;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;
      const paymentIntentId = idOf(session.payment_intent);
      // Delayed payment methods complete unpaid; wait for async_payment_succeeded.
      if (session.payment_status !== "paid" || !accountId || !bookingId || !paymentIntentId) return;
      // A payment link (say, a balance on a booking) is not that booking's
      // deposit: it is recorded as a payment, but never confirms the booking
      // or replaces the deposit's payment.
      if (!session.payment_link) {
        await confirmPaidBooking({
          accountId,
          bookingId,
          sessionId: session.id,
          paymentIntentId,
          amountPaid: session.amount_total ?? 0,
        });
      }
      await bestEffort("record payment", () => recordPaidSession(accountId, session));
      return;
    }

    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const bookingId = event.data.object.metadata?.booking_id;
      const tenantId = await tenantIdForAccount(accountId);
      if (tenantId && bookingId) await releaseHold(tenantId, bookingId);
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId = idOf(charge.payment_intent);
      if (paymentIntentId) await setDepositStatus(accountId, paymentIntentId, depositStatusAfterRefund(charge));
      await bestEffort("record refund", () => recordRefund(accountId, charge.id, charge.amount_refunded));
      return;
    }

    case "charge.dispute.created": {
      // The detailer answers disputes in their own Stripe Dashboard; we make
      // sure they know.
      const dispute = event.data.object;
      const paymentIntentId = idOf(dispute.payment_intent);
      const hit = paymentIntentId ? await setDepositStatus(accountId, paymentIntentId, "disputed") : null;
      const tenantId = hit?.tenantId ?? (await tenantIdForAccount(accountId));
      if (tenantId) {
        await raiseAlert({
          kind: "dispute_opened",
          tenantId,
          bookingId: hit?.bookingId ?? null,
          disputeId: dispute.id,
          amountPence: dispute.amount,
        });
      }
      return;
    }
  }
}

// The resource a thin notification is about, when it has an id.
export function relatedObjectId(notification: Stripe.V2.Core.EventNotification) {
  const related = "related_object" in notification ? notification.related_object : undefined;
  const id = related && "id" in related ? related.id : null;
  return typeof id === "string" ? id : null;
}

// Accounts v2 sends thin notifications: a type and an account id. The state
// is read fresh from the API.
export async function handleAccountNotification(notification: Stripe.V2.Core.EventNotification) {
  switch (notification.type) {
    case "v2.core.account[requirements].updated":
    case "v2.core.account[configuration.merchant].updated":
    case "v2.core.account[configuration.merchant].capability_status_updated": {
      const accountId = relatedObjectId(notification);
      if (accountId) await syncAccountStatus(accountId);
      return;
    }
  }
}
