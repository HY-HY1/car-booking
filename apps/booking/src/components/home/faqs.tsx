import { MessageCircleQuestionMark, Plus } from "lucide-react";
import { answerParagraphs, type Faq } from "@leadgen/core/branding/faq";
import { container } from "@/components/site";

// The business's questions and answers (Settings → Booking page → Questions
// and answers), in its order: a centred heading over a column of questions,
// each opening in place. Also given to search engines as an FAQ page, so the
// answers can show in results.
export function FaqSection({ faqs, contactHref }: { faqs: Faq[]; contactHref: string | null }) {
  if (!faqs.length) return null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };

  return (
    <section id="faqs" aria-labelledby="faqs-title" className="scroll-mt-4 border-t py-14 sm:py-20">
      <div className={container}>
        <div className="mx-auto grid max-w-3xl gap-10">
        <div className="grid justify-items-center gap-4 text-center">
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-wash text-brand">
            <MessageCircleQuestionMark className="size-6" strokeWidth={1.75} />
          </span>
          <div className="grid gap-2">
            <h2 id="faqs-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Questions people ask
            </h2>
            {contactHref && (
              <p className="text-pretty text-neutral-600">
                Can&apos;t see yours?{" "}
                <a href={contactHref} className="font-medium text-neutral-900 underline underline-offset-4">
                  Get in touch
                </a>
                .
              </p>
            )}
          </div>
        </div>

        <ul className="grid gap-3">
          {faqs.map((f) => (
            <li key={f.question}>
              <details className="group rounded-xl border bg-surface transition-colors open:border-neutral-300 open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center gap-4 rounded-xl px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                  <span className="flex-1 font-heading text-base font-semibold text-pretty text-neutral-900 sm:text-lg">{f.question}</span>
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-700 transition group-open:bg-brand group-open:text-brand-fg group-hover:bg-neutral-200 group-open:group-hover:bg-brand"
                  >
                    <Plus className="size-4 transition-transform duration-200 group-open:rotate-45" strokeWidth={2.25} />
                  </span>
                </summary>
                <div className="grid gap-3 px-5 pb-5 text-pretty whitespace-pre-line text-neutral-600 sm:px-6 sm:pb-6">
                  {answerParagraphs(f.answer).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </section>
  );
}
