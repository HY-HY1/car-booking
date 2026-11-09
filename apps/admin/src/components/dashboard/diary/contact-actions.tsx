import { MessageSquare, Navigation, Phone } from "lucide-react";
import { googleMapsUrl } from "@leadgen/core/booking/route-plan";
import { buttonVariants } from "@/components/ui/button";

// Call, text and navigate, each one tap. Shows whichever this job has: a
// customer with no number can't be rung, and a shop job needs no directions.
export function ContactActions({
  phone,
  address,
  locationType,
}: {
  phone: string | null;
  address: string;
  locationType: "mobile" | "unit";
}) {
  const number = phone?.replace(/[^\d+]/g, "");
  const navigate = locationType === "mobile" && address;
  if (!number && !navigate) return null;

  const button = buttonVariants({ variant: "outline", size: "lg", className: "flex-1" });
  return (
    <div className="flex gap-2">
      {number && (
        <>
          <a href={`tel:${number}`} className={button}>
            <Phone />
            Call
          </a>
          <a href={`sms:${number}`} className={button}>
            <MessageSquare />
            Text
          </a>
        </>
      )}
      {navigate && (
        <a href={googleMapsUrl(address)} target="_blank" rel="noopener noreferrer" className={button}>
          <Navigation />
          Navigate
        </a>
      )}
    </div>
  );
}
