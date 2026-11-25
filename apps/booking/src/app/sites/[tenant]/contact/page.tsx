import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, MessageSquareText } from "lucide-react";
import { loadBookingConfig } from "@/lib/booking-config";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { cn } from "@/lib/cn";
import { SiteFrame, container } from "@/components/site";
import { EnquiryForm } from "./enquiry-form";

export const metadata: Metadata = { title: "Ask about a job" };

// The enquiry page: for jobs the instant quote doesn't fit. Each enquiry
// arrives under Leads in the dashboard and emails the owner. Switched on and
// introduced in Settings → Booking page → Trust and enquiries.
export default async function ContactPage() {
  const tenant = await requireRequestTenant();
  const { enquiries } = tenant.branding.extras;
  if (!enquiries.show) notFound();
  const config = await loadBookingConfig(tenant.id);
  const services = (config?.services ?? []).map((s) => s.name);
  const quote = pageUrl(tenant, "/quote");

  return (
    <SiteFrame tenant={tenant}>
      <main className="flex flex-1 flex-col">
        <section className="bg-wash">
          <div className={cn(container, "grid gap-3 py-12 sm:py-16")}>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Ask about a job</h1>
            <p className="max-w-2xl text-lg text-pretty text-neutral-700">
              {enquiries.intro ??
                `Something the instant quote doesn't cover, like a bigger job, several vehicles or a question first? Tell ${tenant.name} about it and they'll get back to you.`}
            </p>
          </div>
        </section>

        <div className={cn(container, "grid gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-12")}>
          <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <EnquiryForm businessName={tenant.name} services={services} privacyUrl={tenant.privacy.policyUrl ?? pageUrl(tenant, "/privacy")} />
          </div>

          <aside className="grid content-start gap-4 text-sm">
            {services.length > 0 && (
              <div className="grid gap-3 rounded-2xl border bg-surface p-5">
                <p className="flex items-center gap-2 font-semibold text-neutral-900">
                  <MessageSquareText className="size-4 text-neutral-400" aria-hidden /> Just want a price?
                </p>
                <p className="text-pretty text-neutral-600">
                  For the usual services you can see your exact price and book a time straight away.
                </p>
                <Link href={quote} className="inline-flex w-fit items-center gap-1 font-medium text-neutral-900 underline-offset-4 hover:underline">
                  Check prices and book <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            )}
            <div className="grid gap-2 rounded-2xl border bg-surface p-5">
              <p className="flex items-center gap-2 font-semibold text-neutral-900">
                <Clock className="size-4 text-neutral-400" aria-hidden /> What happens next
              </p>
              <p className="text-pretty text-neutral-600">
                {tenant.name} reads your message and replies by email{" "}
                or phone, usually with a price or a few questions about the job.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </SiteFrame>
  );
}
