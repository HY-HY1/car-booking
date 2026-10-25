import type { PaymentSource, PaymentStatus } from "@leadgen/core/stripe/payment-rules";

// How payments are labelled wherever they appear (Payments tab, a booking).

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: string }> = {
  paid: { label: "Paid", tone: "bg-emerald-100 text-emerald-900" },
  pending: { label: "Pending", tone: "bg-amber-100 text-amber-900" },
  refunded: { label: "Refunded", tone: "bg-muted text-muted-foreground" },
  partially_refunded: { label: "Part refunded", tone: "bg-muted text-muted-foreground" },
  disputed: { label: "Disputed", tone: "bg-red-100 text-red-900" },
  failed: { label: "Failed", tone: "bg-red-100 text-red-900" },
};

export const PAYMENT_SOURCE: Record<PaymentSource, string> = {
  deposit: "Booking deposit",
  payment_link: "Payment link",
  other: "Other payment",
};
