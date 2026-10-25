import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unsubscribeCustomer } from "@leadgen/core/privacy/data";
import { verifyUnsubscribeToken } from "@leadgen/core/privacy/rules";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import { LegalPage } from "@/components/legal-page";
import { getRequestTenant } from "@/lib/tenant";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

// /unsubscribe?t=<signed token>, linked from every marketing message. The
// token proves the link came from us; the customer must also belong to the
// business at this address. Opting out is idempotent, so it runs on load: mail
// scanners that open links can't undo anything, and one click is all it takes.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const tenant = await getRequestTenant();
  const secret = process.env.PRIVACY_TOKEN_SECRET;
  if (!tenant || !secret) notFound();

  const token = (await searchParams).t ?? "";
  const claim = await verifyUnsubscribeToken(secret, token);
  let ok = false;
  if (claim) {
    const { data } = await createAdminClient()
      .from("customers")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("id", claim.customerId)
      .maybeSingle();
    if (data) {
      await unsubscribeCustomer(tenant.id, claim.customerId, claim.channel);
      ok = true;
    }
  }

  return (
    <LegalPage title={ok ? "You're unsubscribed" : "That link isn't valid"}>
      <p>
        {ok
          ? `${tenant.name} won't send you marketing any more. You'll still get messages about bookings you make.`
          : "It may be incomplete or out of date. You can also make a request on the privacy page."}
      </p>
    </LegalPage>
  );
}
