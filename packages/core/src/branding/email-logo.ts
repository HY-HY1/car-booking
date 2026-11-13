import "server-only";
import type { EmailLogo } from "./email-brand";

// The logo as emails use it: a PNG three times the size it's drawn at (32px
// tall, up to 220px wide, see compose.ts) so it's sharp on phone screens,
// trimmed of empty edges. Made when the owner saves their branding
// (Settings → Booking page), because uploads may be WebP, which Outlook on
// Windows can't show. Not SVG: Gmail and Outlook don't show SVG at all.

export const EMAIL_LOGO_HEIGHT = 96;
const MAX_WIDTH = 660;

export async function makeEmailLogo(source: ArrayBuffer | Uint8Array): Promise<{ png: Buffer; width: number; height: number }> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(Buffer.from(source as ArrayBuffer))
    .trim()
    .resize({ height: EMAIL_LOGO_HEIGHT, width: MAX_WIDTH, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height };
}

// The original logo, fetched from where it's stored, as an email PNG.
export async function emailLogoFromUrl(url: string): Promise<{ png: Buffer; width: number; height: number }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Couldn't fetch the logo: ${response.status}`);
  return makeEmailLogo(await response.arrayBuffer());
}

export type { EmailLogo };
