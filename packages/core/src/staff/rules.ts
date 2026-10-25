import { z } from "zod";
import { normalizePhone } from "../customer-fields";

// Parsing the Staff / Techs editor's form posts into the row they save. No
// database access, so it can be tested. Values arrive as strings, as a
// browser sends them.

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be under ${max} characters.`)
    .transform((v) => v || null);

export const staffFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter their name.").max(80, "Keep the name under 80 characters."),
    job_title: optionalText("The job title", 60),
    phone: z.string().trim(),
    email: z.string().trim().max(200, "That email is too long."),
    notes: optionalText("Notes", 1000),
    // "" = none. Whether the id still exists is checked against the live van list / territories.
    resource_id: z.string().trim(),
    territory_id: z.string().trim().max(40),
    active: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .transform((v, ctx) => {
    const problem = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };

    let phone: string | null = null;
    if (v.phone) {
      phone = normalizePhone(v.phone);
      if (!phone) return problem("phone", "That doesn't look like a phone number.");
    }
    if (v.email && !z.email().safeParse(v.email).success) return problem("email", "That doesn't look like an email address.");
    if (v.resource_id && !z.uuid().safeParse(v.resource_id).success) return problem("resource_id", "Pick one from the list.");

    return {
      name: v.name,
      job_title: v.job_title,
      phone,
      email: v.email ? v.email.toLowerCase() : null,
      notes: v.notes,
      resource_id: v.resource_id || null,
      territory_id: v.territory_id || null,
      active: v.active,
    };
  });
