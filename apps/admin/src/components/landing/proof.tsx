import { RESULT, STATS, TESTIMONIALS, type Testimonial } from "@/lib/proof";
import { PlaceholderTag, kicker } from "./ui";

// Social proof blocks for the marketing pages. Each renders nothing when
// lib/proof.ts has nothing real to show (placeholders drop out in production).

// A row of big figures, on paper.
export function ProofStats() {
  if (STATS.length === 0) return null;
  return (
    <dl className={`grid grid-cols-2 border-t-2 border-(--ink) ${STATS.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {STATS.map((s) => (
        <div key={s.label} className="border-b border-(--rule) py-6 pr-4 odd:border-r odd:pr-4 even:pl-4 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0">
          <dt className="sr-only">{s.label}</dt>
          <dd className="lp-display text-[clamp(2.75rem,5vw,4.25rem)] leading-none">{s.value}</dd>
          <dd className="mt-2 text-sm text-(--graphite)">
            {s.label}
            {s.placeholder && <PlaceholderTag />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Three detailers in their own words, on paper.
export function Testimonials({ heading = "Detailers on it, in their words" }: { heading?: string }) {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <section aria-labelledby="testimonials-heading" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <h2 id="testimonials-heading" className="lp-display max-w-3xl text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
          {heading}
        </h2>
        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <li key={t.name}>
              <TestimonialCard t={t} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <figure className="lp-printed flex h-full flex-col border-2 border-(--ink) bg-white p-6 sm:p-7">
      <span aria-hidden className="lp-display text-6xl leading-none text-(--hi)">
        “
      </span>
      <blockquote className="mt-1 flex-1 text-lg leading-relaxed">{t.quote}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-(--rule) pt-5">
        <span aria-hidden className="lp-display grid size-11 shrink-0 place-items-center bg-(--ink) text-lg text-(--paper)">
          {t.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">
            {t.name}
            {t.placeholder && <PlaceholderTag />}
          </span>
          <span className="block text-sm text-(--graphite)">
            {t.business}, {t.place}
          </span>
          <span className="lp-data block text-xs text-(--graphite)">{t.setup}</span>
        </span>
      </figcaption>
    </figure>
  );
}

// One detailer's before and after, on ink. Null without a real one.
export function ResultBlock() {
  if (!RESULT) return null;
  return (
    <div>
      <p className={`${kicker} text-(--mist)`}>
        {RESULT.business} · {RESULT.place}
        {RESULT.placeholder && <PlaceholderTag />}
      </p>
      <h2 id="result-heading" className="lp-display mt-4 text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
        {RESULT.headline}
      </h2>

      <figure className="mt-8 border-l-4 border-(--hi) pl-6">
        <blockquote className="text-xl leading-snug font-medium sm:text-2xl">“{RESULT.quote.text}”</blockquote>
        <figcaption className="lp-data mt-3 text-sm text-(--mist)">{RESULT.quote.who}</figcaption>
      </figure>

      <table className="mt-10 w-full border-t-2 border-(--paper) text-left">
        <caption className="sr-only">{RESULT.business}, before and after</caption>
        <thead>
          <tr className={`${kicker} text-(--mist)`}>
            <th scope="col" className="py-3 font-normal">
              <span className="sr-only">Measure</span>
            </th>
            <th scope="col" className="py-3 font-normal">
              Before
            </th>
            <th scope="col" className="py-3 font-normal text-(--paper)">
              Now
            </th>
          </tr>
        </thead>
        <tbody>
          {RESULT.metrics.map((m) => (
            <tr key={m.label} className="border-t border-(--rule-dark)">
              <th scope="row" className="py-4 pr-4 font-medium">
                {m.label}
              </th>
              <td className="lp-data py-4 pr-4 text-2xl text-(--mist) line-through decoration-1">{m.before}</td>
              <td className="lp-display py-4 text-4xl text-(--hi)">{m.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
