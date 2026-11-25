import "server-only";
import { STORED_ICON_SIZE } from "./icon-crop";

// Browser tab icons (Settings → Booking page → Search and sharing).

// An uploaded icon as it's stored: an exact 512px square PNG. The dashboard
// crops it to the square the owner picked before sending it; anything that
// arrives not square (the cropper couldn't run) is cropped from the middle,
// so it's always the right shape.
export async function makeTabIcon(source: ArrayBuffer | Uint8Array): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(Buffer.from(source as ArrayBuffer))
    .rotate()
    .resize({ width: STORED_ICON_SIZE, height: STORED_ICON_SIZE, fit: "cover", position: "centre" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// The stored icon at the size a browser asks for (core icon-crop.ts ICON_SIZES).
export async function resizeTabIcon(source: ArrayBuffer | Uint8Array, size: number): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(Buffer.from(source as ArrayBuffer))
    .resize({ width: size, height: size, fit: "cover", position: "centre" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// A logo as a tab icon, if it's near enough square to read that small:
// trimmed and fitted in a `size` square. Null for a wide wordmark.
export async function squareLogoIcon(source: ArrayBuffer | Uint8Array, size: number): Promise<Buffer | null> {
  const { default: sharp } = await import("sharp");
  const trimmed = await sharp(Buffer.from(source as ArrayBuffer)).trim().toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  if (!width || !height || width / height > 1.6 || height / width > 1.6) return null;
  return sharp(trimmed.data)
    .resize({ width: size, height: size, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
