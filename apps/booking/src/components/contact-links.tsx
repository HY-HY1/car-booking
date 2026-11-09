import { Mail, Phone } from "lucide-react";
import { formatPhone } from "@leadgen/core/customer-fields";

// Ring or email the business, for wherever the booking form can't help.
export function ContactLinks({ phone, email }: { phone: string | null; email: string | null }) {
  if (!phone && !email) return null;
  const link =
    "inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-current/25 bg-white px-4 text-sm font-medium text-neutral-900 transition hover:border-neutral-400";
  return (
    <div className="flex flex-wrap gap-2">
      {phone && (
        <a href={`tel:${phone}`} className={link}>
          <Phone className="size-4 shrink-0" />
          {formatPhone(phone)}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={link}>
          <Mail className="size-4 shrink-0" />
          <span className="truncate">{email}</span>
        </a>
      )}
    </div>
  );
}
