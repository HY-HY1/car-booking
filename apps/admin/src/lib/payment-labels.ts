import type { PaymentSource, PaymentStatus } from "@leadgen/core/stripe/payment-rules";
import type { BadgeTone } from "@/components/ui/badge";

// How payments are labelled wherever they appear (Payments tab, a booking).

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: "Paid", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Part refunded", tone: "neutral" },
  disputed: { label: "Disputed", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
};

export const PAYMENT_SOURCE: Record<PaymentSource, string> = {
  deposit: "Booking deposit",
  payment_link: "Payment link",
  other: "Other payment",
  cash: "Cash",
  bank_transfer: "Bank transfer",
};
