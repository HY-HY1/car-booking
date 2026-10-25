"use server";

import { redirect } from "next/navigation";
import { AWAITING_CHECKOUT, signupSchema, slugCandidates } from "@leadgen/core/billing/rules";
import { TERMS_VERSION } from "@leadgen/core/privacy/platform";
import { createBusiness } from "@leadgen/core/platform/businesses";
import { newBusinessSchema } from "@leadgen/core/platform/rules";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import { elementsCheckout, signupMissing } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";

export type SignUpState = {
  errors?: Record<string, string>;
  message?: string;
  // What was typed, minus the password, so a failed submit doesn't empty the form.
  values?: Record<string, string>;
  // The account and business exist; this is the card form for the last stage.
  checkout?: { clientSecret: string; priceLabel: string; slug: string };
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Create an account, a business with starter settings, sign them in, and set
// up the trial's payment, which is returned for the last stage to show as
// Stripe's card form on the page. Everything before Stripe is undone if any
// part fails, so a retry never meets a half-made account. If the person walks
// away without paying, the business is kept (status awaiting_checkout) and the
// billing page lets them carry on after signing in.
export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "password") values[key] = value;
  }

  // A field real people never see; bots fill in everything.
  if (text(formData, "website")) return { message: "Something went wrong. Please try again.", values };
  const missing = signupMissing();
  if (missing.length) {
    console.error(`Sign-up is closed: set ${missing.join(", ")} in the root .env.local.`);
    return {
      message:
        process.env.NODE_ENV === "production"
          ? "Sign-up isn't open yet. Please try again soon."
          : `Sign-up can't start: set ${missing.join(", ")} in the root .env.local (see .env.example), then reload.`,
      values,
    };
  }

  const parsed = signupSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: String(formData.get("password") ?? ""),
    businessName: text(formData, "businessName"),
    trade: text(formData, "trade"),
    locations: text(formData, "locations"),
    postcode: text(formData, "postcode"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { errors, message: "Fix the highlighted fields.", values };
  }
  const signup = parsed.data;
  // Owners must accept the terms and data processing terms to open an account.
  if (text(formData, "terms") !== "on") {
    return { errors: { terms: "Tick the box to agree before continuing." }, message: "Fix the highlighted fields.", values };
  }

  const db = createAdminClient();
  // Confirmed straight away: the card on the next screen is the check that
  // this is a real person, and there's no email sender to confirm with yet.
  const created = await db.auth.admin.createUser({
    email: signup.email,
    password: signup.password,
    email_confirm: true,
    user_metadata: { name: signup.name },
  });
  if (created.error) {
    if (created.error.code === "email_exists") {
      return { errors: { email: "There's already an account with that email. Sign in instead." }, values };
    }
    if (created.error.code === "weak_password") {
      return { errors: { password: "Pick a stronger password." }, message: "Fix the highlighted fields.", values };
    }
    console.error("Sign-up: couldn't create the user", created.error);
    return { message: "Couldn't create your account. Please try again.", values };
  }
  const userId = created.data.user.id;

  let tenant: { id: string; slug: string } | null = null;
  try {
    for (const slug of slugCandidates(signup.businessName)) {
      const result = await createBusiness(
        newBusinessSchema.parse({
          name: signup.businessName,
          slug,
          ownerEmail: signup.email,
          locations: signup.locations,
          basePostcode: signup.locations === "unit" ? "" : signup.postcode,
          unitPostcode: signup.locations === "mobile" ? "" : signup.postcode,
          addMe: false,
        }),
        userId,
        {
          ownerUserId: userId,
          tenant: {
            trade: signup.trade,
            subscription_status: AWAITING_CHECKOUT,
            terms_accepted_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
          },
        },
      );
      if (result.ok) {
        tenant = { id: result.tenantId, slug: result.slug };
        break;
      }
      // Someone else has that address: try the next, "name-2". Anything else is a real failure.
      if (result.field === "form") break;
    }
  } catch (error) {
    console.error("Sign-up: couldn't create the business", error);
  }

  if (!tenant) {
    await db.auth.admin.deleteUser(userId);
    return { message: "Couldn't set up your business. Nothing was saved; please try again.", values };
  }

  const supabase = await createClient();
  const signedIn = await supabase.auth.signInWithPassword({ email: signup.email, password: signup.password });
  // The account exists, so a plain sign-in will carry on from billing.
  if (signedIn.error) redirect(appUrl("/login"));

  let checkout: Awaited<ReturnType<typeof elementsCheckout>> | null = null;
  try {
    checkout = await elementsCheckout(tenant, signup.email);
  } catch (error) {
    console.error("Sign-up: couldn't set up the card form", error);
  }
  // The account is safe; the billing page offers Stripe's own page to finish.
  if (!checkout) redirect(appUrl(`/signup/billing?tenant=${encodeURIComponent(tenant.slug)}&error=1`));

  // The browser shows the card form on the last stage and takes it from here.
  return { checkout: { ...checkout, slug: tenant.slug } };
}
