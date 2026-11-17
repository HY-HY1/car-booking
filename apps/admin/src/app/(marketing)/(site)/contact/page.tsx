import { Suspense } from "react";
import type { Metadata } from "next";
import { isContactTopic } from "@leadgen/core/marketing/contact-topics";
import { ContactForm } from "@/components/landing/contact-form";
import { PageHero } from "@/components/landing/site-ui";
import { SITE_NAME } from "@/lib/brand";
import { docsUrl, marketingUrl } from "@/lib/urls";

// Contact: a short list of what we can help with, beside the form. The form
// works for real (./actions.ts); a link's ?topic= picks its topic.

export const metadata: Metadata = {
  title: "Contact",
  description: `Questions about ${SITE_NAME}, a live demo, or a website built around your bookings. Send us a message.`,
};

const REASONS = [
  ["A live demo", "We'll show you round on a call, using services and prices like yours."],
  ["Help choosing", "Not sure it fits how you work? Tell us about your vans, your hours and what you use now."],
  ["A website", "We build websites for detailing businesses that plug straight into your bookings."],
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
      <PageHero
        eyebrow="Contact"
        title="Talk to a person"
        intro="Questions, a live demo, or help getting set up. Send a message and a real person will reply by email."
      />

      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          {/* The form comes first on a phone, beside the reasons on desktop. */}
          <div className="order-2 lg:order-1">
            <h2 className="text-sm font-medium text-(--accent)">What we can help with</h2>
            <dl className="mt-4 border-t border-(--line)">
              {REASONS.map(([title, text]) => (
                <div key={title} className="border-b border-(--line) py-5">
                  <dt className="font-semibold">{title}</dt>
                  <dd className="mt-1 text-(--muted)">{text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm text-(--muted)">
              Already using {SITE_NAME}? Message us here too
              {docs && (
                <>
                  , or read{" "}
                  <a href={docs} className="font-medium text-(--fg) underline underline-offset-4 hover:text-(--accent)">
                    the docs
                  </a>
                </>
              )}
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
