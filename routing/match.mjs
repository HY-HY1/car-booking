// Which app a request goes to under the rules in rules.mjs, for the dev
// router. Covers the parts of Vercel's matching those rules use: an exact
// path, a "/prefix/(.*)" pattern, and a host (compared without a port) that's
// either an exact name or { suf } for a suffix.
export function serviceFor(rules, pathname, host) {
  const hostname = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  const hostMatches = (value) => (typeof value === "string" ? value === hostname : hostname.endsWith(value.suf));
  for (const rule of rules) {
    const matchesPath = rule.source.endsWith("(.*)")
      ? pathname.startsWith(rule.source.slice(0, -"(.*)".length))
      : pathname === rule.source;
    const matchesHost = !rule.has || rule.has.every((h) => h.type === "host" && hostMatches(h.value));
    if (matchesPath && matchesHost) return rule.destination.service;
  }
  return "admin";
}
