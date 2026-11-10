// Sign-in rules with no database access, so the proxy, pages and tests can
// all use them.

// Signed in with a password, with two-factor switched on, and no code entered
// yet in this session.
export function awaitingSecondFactor(level: { currentLevel: string | null; nextLevel: string | null } | null | undefined) {
  return level?.currentLevel === "aal1" && level.nextLevel === "aal2";
}

// The six digits from an authenticator app, however they were typed.
export function cleanCode(value: unknown) {
  const code = String(value ?? "").replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

// One reset email per address in this time, so nobody can flood an inbox.
export const RESET_COOLDOWN_MS = 2 * 60_000;

export function resetAllowed(lastSentAt: string | null | undefined, now: Date) {
  return !lastSentAt || now.getTime() - new Date(lastSentAt).getTime() >= RESET_COOLDOWN_MS;
}
