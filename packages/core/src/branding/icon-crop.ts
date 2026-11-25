// The square an owner picks out of a picture for their browser tab icon
// (Settings → Booking page → Search and sharing). Pure, so the dashboard's
// cropper and the tests share it.

// The sizes the icon is served at: the browser tab (32, and 48 for some),
// the phone home screen (180 for iPhones, 192 for Android) and the largest
// Android uses (512), which is also the size it's stored at.
export const ICON_SIZES = [32, 48, 180, 192, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];
export const STORED_ICON_SIZE = 512;
export const MAX_ICON_ZOOM = 5;

// The size asked for in ?size=, or the tab size.
export function iconSize(asked: string | null): IconSize {
  const n = Number(asked);
  return (ICON_SIZES as readonly number[]).includes(n) ? (n as IconSize) : 32;
}

// Zoom 1 takes the largest square that fits; zoom 2 one half as wide, and so
// on. The centre is where in the picture the square sits (0 to 1 across and
// down), kept far enough in that the square never runs off the edge.
export function squareCrop(width: number, height: number, zoom: number, centre: { x: number; y: number }) {
  const side = Math.min(width, height) / Math.min(MAX_ICON_ZOOM, Math.max(1, zoom));
  const half = side / 2;
  const clamp = (v: number, max: number) => Math.min(max - half, Math.max(half, v));
  const x = clamp(centre.x * width, width);
  const y = clamp(centre.y * height, height);
  return {
    sx: x - half,
    sy: y - half,
    side,
    // The centre after clamping, so dragging past the edge stops there.
    centre: { x: x / width, y: y / height },
  };
}
