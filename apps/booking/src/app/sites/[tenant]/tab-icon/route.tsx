import { ImageResponse } from "next/og";
import { bookingColors } from "@leadgen/core/branding/colors";
import { iconSize } from "@leadgen/core/branding/icon-crop";
import { resizeTabIcon, squareLogoIcon } from "@leadgen/core/branding/tab-icon";
import { getRequestTenant } from "@/lib/tenant";

// The business's browser tab icon, as an exact square PNG at the size asked
// for (?size=32, 48, 180, 192 or 512; the tab's 32 otherwise): the icon the
// owner uploaded and cropped (Settings → Booking page → Search and sharing),
// or else its logo when that's near enough square to read so small, or else
// its initial on its brand colour.

const ROUND = 0.22;

export async function GET(request: Request) {
  const tenant = await getRequestTenant();
  if (!tenant) return new Response("Not found", { status: 404 });
  const size = iconSize(new URL(request.url).searchParams.get("size"));
  const headers = { "Cache-Control": "public, max-age=86400", "Content-Type": "image/png" };
  const png = (bytes: Buffer) => new Response(new Uint8Array(bytes), { headers });

  const own = tenant.branding.seo.icon_url ? await fetchImage(tenant.branding.seo.icon_url).catch(() => null) : null;
  if (own) return png(await resizeTabIcon(own, size));

  // A logo wider than this is a wordmark, unreadable in a tab.
  const logo = tenant.branding.logo_url ? await fetchImage(tenant.branding.logo_url).catch(() => null) : null;
  const fromLogo = logo ? await squareLogoIcon(logo, size).catch(() => null) : null;
  if (fromLogo) return png(fromLogo);

  const { panel, panelFg } = bookingColors(tenant.branding).light;
  const initial = tenant.name.trim().charAt(0).toUpperCase() || "•";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: panel,
          color: panelFg,
          borderRadius: size * ROUND,
          fontSize: size * 0.62,
          fontWeight: 700,
          // A white brand would vanish on a white tab bar: a hairline keeps
          // its shape. Left out otherwise: the renderer fails on undefined.
          ...(panel.toLowerCase() === "#ffffff" && { border: `${Math.max(1, size / 32)}px solid #d4d4d4` }),
        }}
      >
        {initial}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": headers["Cache-Control"] } },
  );
}

async function fetchImage(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  return response.arrayBuffer();
}
