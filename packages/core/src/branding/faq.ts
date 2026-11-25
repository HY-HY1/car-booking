import { z } from "zod";

// The business's questions and answers, shown on the booking page's home in
// the order the owner sets (Settings → Booking page → Questions and
// answers). Kept in tenants.branding, so no migration: a broken entry is
// dropped rather than failing the page.

export const MAX_FAQS = 20;
export const MAX_QUESTION = 150;
export const MAX_ANSWER = 1500;

export type Faq = { question: string; answer: string };

const faqSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION),
  answer: z.string().trim().min(1).max(MAX_ANSWER),
});

export const faqsSchema = z
  .array(z.unknown())
  .catch([])
  .transform((items): Faq[] =>
    items
      .flatMap((item) => {
        const parsed = faqSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
      .slice(0, MAX_FAQS),
  );

const tidy = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

// The form's rows, in the order they were sent (the order the owner dragged
// them into): question_i and answer_i pair up by position. A row left blank
// is skipped; half a row, or one too long, is an error on that field, keyed
// by its place in the form so the form can show it beside the right box.
export function parseFaqForm(
  questions: readonly string[],
  answers: readonly string[],
): { faqs: Faq[]; errors?: undefined } | { faqs?: undefined; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const faqs: Faq[] = [];
  const rows = Math.max(questions.length, answers.length);
  for (let i = 0; i < rows; i++) {
    const question = tidy(questions[i] ?? "").replace(/\s+/g, " ");
    const answer = tidy(answers[i] ?? "");
    if (!question && !answer) continue;
    if (!question) errors[`question_${i}`] = "Add the question, or clear the answer to remove it.";
    else if (question.length > MAX_QUESTION) errors[`question_${i}`] = `Keep the question under ${MAX_QUESTION} characters.`;
    if (!answer) errors[`answer_${i}`] = "Add an answer, or clear the question to remove it.";
    else if (answer.length > MAX_ANSWER) errors[`answer_${i}`] = `Keep the answer under ${MAX_ANSWER} characters.`;
    if (question && answer) faqs.push({ question, answer });
  }
  if (faqs.length > MAX_FAQS) errors.faqs = `You can have up to ${MAX_FAQS} questions.`;
  return Object.keys(errors).length ? { errors } : { faqs };
}

// The answer's paragraphs: split at blank lines; single line breaks are kept.
export function answerParagraphs(answer: string) {
  return answer
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
