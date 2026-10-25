// Which app a request goes to under the rules in vercel.ts, for the dev
// router. Covers the parts of Vercel's matching that vercel.ts uses: an exact
// path, a "/prefix/(.*)" pattern, and an exact host (compared without a port).
export function serviceFor(rules, pathname, host) {
  const hostname = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  for (const rule of rules) {
    const matchesPath = rule.source.endsWith("(.*)")
      ? pathname.startsWith(rule.source.slice(0, -"(.*)".length))
      : pathname === rule.source;
    const matchesHost = !rule.has || rule.has.every((h) => h.type === "host" && h.value === hostname);
    if (matchesPath && matchesHost) return rule.destination.service;
  }
  return "admin";
}
