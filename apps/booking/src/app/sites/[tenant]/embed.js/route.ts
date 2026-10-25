import { getRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

// GET /embed.js: the script a detailer adds to their own site:
//
//   <script src="https://bookings.theirsite.co.uk/embed.js" async></script>
//
// It adds a floating button (its text and side set in Settings → Booking page)
// that opens this tenant's quote flow in a side panel on the same side. Any
// element on their page with data-instant-quote
// opens it too; data-instant-quote="full-valet" (a service slug or id) opens
// it with that service already chosen, as does InstantQuote.open("full-valet").
// The tenant is the address the script is loaded from (/booking/<slug>/embed.js,
// <slug>.domain.com/embed.js or a custom domain), so the snippet is the same
// for every client apart from that address.
export async function GET() {
  const tenant = await getRequestTenant();
  if (!tenant) {
    return new Response(`console.warn("Instant quote: no business is set up at this address");`, {
      status: 404,
      headers: { "content-type": "text/javascript; charset=utf-8" },
    });
  }

  const quoteUrl = pageUrl(tenant, "/quote?embed=1", { absolute: true });
  const config = {
    name: tenant.name,
    brand: tenant.branding.primary_color,
    accent: tenant.branding.accent_color,
    label: tenant.branding.button_label ?? "Instant quote",
    side: tenant.branding.button_position,
    url: quoteUrl,
    origin: new URL(quoteUrl).origin,
  };

  return new Response(script(config), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

function script(config: {
  name: string;
  brand: string;
  accent: string;
  label: string;
  side: "left" | "right";
  url: string;
  origin: string;
}) {
  return `(function () {
  if (window.InstantQuote) return;
  var cfg = ${JSON.stringify(config)};
  var Z = 2147483000;

  function el(tag, css, text) {
    var e = document.createElement(tag);
    e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }

  var font = "font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;";
  var button = el("button",
    font + "position:fixed;" + cfg.side + ":20px;bottom:20px;z-index:" + Z + ";border:0;border-radius:999px;" +
    "padding:14px 22px;font-size:16px;font-weight:600;cursor:pointer;color:#fff;background:" + cfg.brand + ";" +
    "box-shadow:0 6px 24px rgba(0,0,0,.25);", cfg.label);
  button.type = "button";
  button.setAttribute("aria-haspopup", "dialog");

  var overlay = el("div", "position:fixed;inset:0;z-index:" + (Z + 1) + ";background:rgba(0,0,0,.4);display:none;");
  var panel = el("div",
    font + "position:fixed;top:0;" + cfg.side + ":0;bottom:0;width:min(440px,100%);z-index:" + (Z + 2) + ";background:#fafafa;" +
    "display:none;flex-direction:column;box-shadow:-8px 0 32px rgba(0,0,0,.2);");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Instant quote from " + cfg.name);

  var header = el("div",
    "display:flex;align-items:center;justify-content:space-between;padding:12px 16px;color:#fff;background:" + cfg.brand + ";");
  header.appendChild(el("strong", "font-size:16px;", cfg.name));
  var close = el("button", "border:0;background:none;color:inherit;font-size:26px;line-height:1;cursor:pointer;padding:0 4px;", "\u00d7");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  header.appendChild(close);
  panel.appendChild(header);

  // The form is only reloaded when a different service is asked for, so
  // closing and reopening the panel keeps what the customer has typed.
  var frame = null;
  var frameService = null;
  function open(service) {
    service = typeof service === "string" && service.trim() ? service.trim() : null;
    if (!frame) {
      frame = el("iframe", "flex:1;width:100%;border:0;");
      frame.title = "Instant quote";
      panel.appendChild(frame);
    }
    if (!frame.src || (service && service !== frameService)) {
      frame.src = cfg.url + (service ? "&service=" + encodeURIComponent(service) : "");
      frameService = service;
    }
    overlay.style.display = "block";
    panel.style.display = "flex";
    button.style.display = "none";
    close.focus();
  }
  function hide() {
    overlay.style.display = "none";
    panel.style.display = "none";
    button.style.display = "";
  }

  // Stripe's checkout page can't load inside the panel, so the quote flow asks
  // for the whole window to go there. Only our own panel, and only Stripe.
  window.addEventListener("message", function (e) {
    if (e.origin !== cfg.origin || !e.data || e.data.type !== "instant-quote:checkout") return;
    try {
      var target = new URL(e.data.url);
      if (target.protocol === "https:" && target.hostname === "checkout.stripe.com") {
        window.location.href = target.href;
      }
    } catch (err) {}
  });

  button.addEventListener("click", function () { open(); });
  close.addEventListener("click", hide);
  overlay.addEventListener("click", hide);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("[data-instant-quote]");
    if (t) { e.preventDefault(); open(t.getAttribute("data-instant-quote")); }
  });

  function mount() {
    document.body.appendChild(button);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  window.InstantQuote = { open: open, close: hide };
})();
`;
}
