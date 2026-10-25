import { getRequestTenant } from "@/lib/tenant";
import { pageUrl, tenantUrl } from "@/lib/urls";

// GET <booking page>/embed-test: a stand-in for a detailer's own website that
// loads the embed script, so the floating button can be tried the way it
// appears on a real site. Development only.
//
//   /booking/ascnd/embed-test               (path mode)
//   ascnd.localhost:3000/embed-test         (subdomain mode)
//
// Open it on 127.0.0.1:3000 instead of localhost:3000 to load the script
// cross-origin, like a client's site on its own domain.
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }
  const tenant = await getRequestTenant();
  if (!tenant) return new Response("Not found", { status: 404 });

  const scriptUrl = pageUrl(tenant, "/embed.js", { absolute: true });
  const others = ["ascnd", "test-detailing"].map((slug) => `<a href="${tenantUrl(slug, "/embed-test")}">${slug}</a>`).join(" · ");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Embed test: ${tenant.slug}</title>
  <style>
    body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #222; }
    header { padding: 20px 24px; background: #222; color: #f4f1ea; }
    main { max-width: 640px; margin: 0 auto; padding: 32px 24px 120px; line-height: 1.6; }
    .note { font-family: system-ui, sans-serif; font-size: 14px; background: #fff; border: 1px dashed #999; padding: 12px 16px; }
    .status { font-weight: 600; }
    .status.bad { color: #b91c1c; }
    .status.good { color: #15803d; }
    .cta { display: inline-block; margin-top: 8px; padding: 10px 18px; background: #222; color: #fff; text-decoration: none; }
  </style>
</head>
<body>
  <header><strong>A detailer's existing website</strong></header>
  <main>
    <p class="note">
      This page stands in for a client's own site. It loads
      <code>${scriptUrl}</code><br>
      <span id="status" class="status">Loading the embed script…</span><br>
      Try: ${others}
    </p>
    <h1>Professional car detailing</h1>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Their own copy, photos and
      reviews live here, untouched.</p>
    <p>Buttons already on their site can open the quote panel too:</p>
    <a href="#" class="cta" data-instant-quote>Book now</a>
  </main>
  <script>
    function embedStatus(ok) {
      var el = document.getElementById("status");
      el.className = "status " + (ok ? "good" : "bad");
      el.textContent = ok
        ? "Loaded: the button is in the bottom corner."
        : "The embed script didn't load. Check the dev servers are running.";
    }
  </script>
  <script src="${scriptUrl}" async onload="embedStatus(true)" onerror="embedStatus(false)"></script>
</body>
</html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
