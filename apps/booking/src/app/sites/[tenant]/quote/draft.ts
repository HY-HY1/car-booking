// Keeps a half-finished booking through a refresh. In sessionStorage, so it
// stays on this tab and is gone when the tab closes: it holds the customer's
// contact details, and someone else may use this computer next.

const VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60_000;

const keyFor = (slug: string) => `booking-draft:${slug}`;

// Read once as the page opens; from then on the form is the one in charge.
const opened = new Map<string, string | null>();

export function openingDraft(slug: string) {
  if (!opened.has(slug)) {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(keyFor(slug));
    } catch {
      // Storage can be switched off: the form just doesn't remember.
    }
    opened.set(slug, raw);
  }
  return opened.get(slug) ?? null;
}

// Next time this form opens, read again.
export function forgetOpeningDraft(slug: string) {
  opened.delete(slug);
}

export function parseDraft<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as { version: number; savedAt: number; draft: T };
    if (stored.version !== VERSION || Date.now() - stored.savedAt > MAX_AGE_MS) return null;
    return stored.draft;
  } catch {
    return null;
  }
}

export function saveDraft<T>(slug: string, draft: T) {
  try {
    sessionStorage.setItem(keyFor(slug), JSON.stringify({ version: VERSION, savedAt: Date.now(), draft }));
  } catch {
    // Full or switched off.
  }
}

export function clearDraft(slug: string) {
  opened.delete(slug);
  try {
    sessionStorage.removeItem(keyFor(slug));
  } catch {
    // Nothing to clear.
  }
}
