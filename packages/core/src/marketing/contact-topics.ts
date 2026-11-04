// What a contact form message can be about. Its own file so the form in the
// browser doesn't pull in the validation (./contact.ts).

export const CONTACT_TOPICS = {
  question: "A question",
  demo: "A live demo",
  website: "A website built for me",
  other: "Something else",
} as const;

export type ContactTopic = keyof typeof CONTACT_TOPICS;

export function isContactTopic(value: unknown): value is ContactTopic {
  return typeof value === "string" && Object.hasOwn(CONTACT_TOPICS, value);
}
