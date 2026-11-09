import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { isContactTopic } from "@leadgen/core/marketing/contact-topics";
import { ContactForm } from "@/components/landing/contact-form";
import { PageIntro, kicker } from "@/components/landing/ui";
import { PRODUCT_NAME } from "@/lib/brand";
import { docsUrl, marketingUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Contact",
  description: `Questions about ${PRODUCT_NAME}, a live demo, or a website built around your bookings. Send us a message.`,
};

const REASONS = [
  ["A live demo", "We'll show you round on a call, using services and prices like yours, and answer your questions as we go."],
  ["Help choosing", "Not sure it fits how you work? Tell us about your vans, your hours and what you use now."],
  ["A website", "We build websites for detailing businesses that plug straight into your bookings. Quoted per project."],
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Only the form depends on the link's ?topic=, so the rest of the page can be
// built ahead of time.
async function FormForTopic({ searchParams, privacyHref }: { searchParams: SearchParams; privacyHref: string }) {
  const { topic } = await searchParams;
  return <ContactForm topic={isContactTopic(topic) ? topic : "question"} privacyHref={privacyHref} />;
}

export default function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const docs = docsUrl();
  const privacyHref = marketingUrl("/legal/privacy");

  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title={
          <>
            Talk to a person<span className="text-(--hi)">.</span>
          </>
        }
      >
        <p>Questions, a live demo, or help getting set up. Send a message and a real person will reply by email.</p>
      </PageIntro>

      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          {/* The form comes first on a phone, beside the reasons on desktop. */}
          <div className="order-2 lg:order-1">
            <h2 className={`${kicker} text-(--mist)`}>What we can help with</h2>
            <dl className="mt-4 border-t border-(--rule-dark)">
              {REASONS.map(([title, text]) => (
                <div key={title} className="border-b border-(--rule-dark) py-5">
                  <dt className="text-lg font-semibold">{title}</dt>
                  <dd className="mt-1 text-(--mist)">{text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 text-(--mist)">
              Already using {PRODUCT_NAME}? Message us here too
              {docs && (
                <>
                  , or read{" "}
                  <a href={docs} className="text-(--paper) underline decoration-(--hi) decoration-2 underline-offset-4">
                    the docs
                  </a>
                </>
              )}
              . Want to try it first?{" "}
              <Link href="/how-it-works" className="text-(--paper) underline decoration-(--hi) decoration-2 underline-offset-4">
                See how it works
              </Link>
              .
            </p>
          </div>

          <div className="order-1 lg:order-2">
            <Suspense fallback={<ContactForm topic="question" privacyHref={privacyHref} />}>
              <FormForTopic searchParams={searchParams} privacyHref={privacyHref} />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  );
}
