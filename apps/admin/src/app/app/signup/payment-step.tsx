"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import { TRIAL_DAYS } from "@leadgen/core/billing/rules";
import { Button } from "@/components/ui/button";

// The last signup stage: Stripe's Payment Element inside our own page. The
// card details go straight from Stripe's iframe to Stripe; our server never
// sees them. Confirming sends the browser to the Checkout Session's return
// address (/onboarding/complete), which records the subscription and moves on
// to setup, exactly as Stripe's hosted page does.

// Loaded once, outside any component, as Stripe asks. Null when the key isn't
// set, in which case the signup never gets this far (it uses Stripe's page).
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

// Stripe draws the card fields in an iframe, so they take their look from here
// rather than from our CSS: matched to the page's colours, radius and font.
const appearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#171717",
    colorText: "#171717",
    colorDanger: "#dc2626",
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
};

export function PaymentStep({ clientSecret, priceLabel }: { clientSecret: string; priceLabel: string }) {
  return (
    // The client secret can't change once set, so a new one means a new provider.
    <CheckoutElementsProvider key={clientSecret} stripe={stripePromise} options={{ clientSecret, elementsOptions: { appearance } }}>
      <CardForm priceLabel={priceLabel} />
    </CheckoutElementsProvider>
  );
}

function CardForm({ priceLabel }: { priceLabel: string }) {
  const checkoutState = useCheckoutElements();
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (checkoutState.type === "error") {
    return (
      <p role="alert" className="text-sm text-destructive">
        The card form couldn&apos;t load: {checkoutState.error.message} Reload the page to try again.
      </p>
    );
  }

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (checkoutState.type !== "success") return;
    setPaying(true);
    setError(null);
    const result = await checkoutState.checkout.confirm();
    // Only reached if something stopped it (a declined or incomplete card).
    // Otherwise Stripe has already sent the browser on to the return address.
    if (result.type === "error") {
      setError(result.error.message);
      setPaying(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1 rounded-xl p-4 text-sm ring-1 ring-foreground/10">
        <p className="font-medium">{TRIAL_DAYS} days free</p>
        <p className="text-muted-foreground">
          Then {priceLabel}. Cancel any time before the trial ends and you pay nothing.
        </p>
      </div>

      <form onSubmit={pay} className="grid gap-4">
        <div className="relative min-h-40">
          {/* Until Stripe's fields arrive, hold the space so the page doesn't jump. */}
          {!ready && <div aria-hidden className="absolute inset-0 animate-pulse rounded-xl bg-muted/60" />}
          {/* Which methods appear is set in the Stripe Dashboard (Settings → Payment methods).
              Whatever they are, the first one, card, opens with its fields showing. */}
          <PaymentElement
            options={{ layout: { type: "accordion", defaultCollapsed: false, radios: "never", spacedAccordionItems: true } }}
            onReady={() => setReady(true)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={!ready || paying || checkoutState.type !== "success"} className="w-full">
          {paying ? "Starting your trial…" : "Start my free trial"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Your card is checked but not charged today. Payments are handled securely by Stripe.
        </p>
      </form>
    </div>
  );
}
