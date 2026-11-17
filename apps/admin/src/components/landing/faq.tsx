import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { PRICE } from "@/lib/brand";
import { Section } from "./site-ui";

// The home page's questions, as an accordion that opens one answer at a time
// and works without JavaScript (<details name>). DRAFT: the wording is still
// being agreed with the owner (2026-11-16).

const QUESTIONS: [question: string, answer: string][] = [
  [
    "What does it cost?",
    `${PRICE.monthly} a month after a ${PRICE.trialDays}-day free trial. No contract, no booking fees, and we never take a cut of your deposits.`,
  ],
  [
    "Do I need a website?",
    "No. Your booking page works on its own from day one. If you already have a website, Book now buttons styled to match link it straight to your booking page.",
  ],
  [
    "Can it run on my own web address?",
    "Yes. Your booking page can live at book.yourbusiness.com, or on a free address we give you until you're ready.",
  ],
  [
    "How does it work out the price?",
    "You set the price of each service for each size of car, plus any extras. Customers can add photos, and the quote allows for a car that needs more work. If it can't tell, it flags the booking for you to check.",
  ],
  [
    "Where do deposits go?",
    "Straight into your own Stripe account. We never hold your money. Stripe charges its standard card fee.",
  ],
  [
    "What about no-shows?",
    "Customers pay a deposit to book, and your cancellation policy decides what's refunded. Reminders can go out automatically before every job.",
  ],
  [
    "Will it work with my calendar?",
    "Yes. It syncs both ways with Google Calendar, so jobs appear in your calendar and your own plans block out booking times.",
  ],
  ["Can my staff use it?", "Yes. Each person gets their own login, with office, technician or manager access."],
  [
    "Can I cancel, and what happens to my data?",
    "Cancel any time; there's no contract. Your customer data is yours: export it whenever you like. Tools for customers' privacy requests are built in.",
  ],
];

export function Faq() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions, answered" center>
      <div className="mx-auto max-w-3xl border-t border-(--line)">
        {QUESTIONS.map(([question, answer]) => (
          <details key={question} name="faq" className="site-faq group border-b border-(--line)">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-lg font-medium hover:text-(--accent) [&::-webkit-details-marker]:hidden">
              {question}
              <Plus aria-hidden className="size-5 shrink-0 text-(--muted) transition-transform duration-200 group-open:rotate-45 group-open:text-(--accent)" />
            </summary>
            <p className="pr-10 pb-6 text-pretty text-(--muted)">{answer}</p>
          </details>
        ))}
      </div>
      <p className="mt-10 text-center text-(--muted)">
        Something else?{" "}
        <Link href="/contact" className="inline-flex items-center gap-1 font-medium text-(--fg) hover:text-(--accent)">
          Ask us
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </p>
    </Section>
  );
}
