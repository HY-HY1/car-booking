import { redirect } from "next/navigation";
import { stripeOnboardingUrl } from "@/lib/stripe";

// Stripe's refresh_url: an onboarding link expired or was already used. Makes
// a new one and sends the signed-in owner on to it.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("tenant");
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return new Response("Not found", { status: 404 });
  redirect(await stripeOnboardingUrl(slug));
}
