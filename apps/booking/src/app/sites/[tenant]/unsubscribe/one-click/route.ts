import { getRequestTenant } from "@/lib/tenant";
import { unsubscribeWithToken } from "@/lib/unsubscribe";
import { pageUrl } from "@/lib/urls";

// /unsubscribe/one-click?t=<signed token>: the address in marketing emails'
// List-Unsubscribe header. Gmail, Apple Mail and Outlook show their own
// "Unsubscribe" button for it and POST "List-Unsubscribe=One-Click" here
// (RFC 8058); mail scanners only ever GET, which just shows the page that asks.
export async function POST(request: Request) {
  const tenant = await getRequestTenant();
  if (!tenant) return new Response("Not found", { status: 404 });
  const token = new URL(request.url).searchParams.get("t") ?? "";
  try {
    const ok = await unsubscribeWithToken(tenant.id, token);
    return new Response(ok ? "Unsubscribed" : "Invalid link", { status: ok ? 200 : 400 });
  } catch (error) {
    console.error("One-click unsubscribe failed", error);
    return new Response("Try again", { status: 500 });
  }
}

export async function GET(request: Request) {
  const tenant = await getRequestTenant();
  if (!tenant) return new Response("Not found", { status: 404 });
  const token = new URL(request.url).searchParams.get("t") ?? "";
  return Response.redirect(pageUrl(tenant, `/unsubscribe?t=${encodeURIComponent(token)}`, { absolute: true }), 303);
}
