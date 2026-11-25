import { afterEach, describe, expect, it, vi } from "vitest";
import { loginUrl, secondFactorUrl } from "./urls";

function mode(env: { mode: string; root: string; site: string }) {
  vi.stubEnv("NEXT_PUBLIC_ROUTING_MODE", env.mode);
  vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", env.root);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", env.site);
}

afterEach(() => vi.unstubAllEnvs());

describe("sign-in page", () => {
  it("sends the super-admin to its own host's sign-in when it has one", () => {
    mode({ mode: "subdomain", root: "domain.com", site: "https://domain.com" });
    expect(loginUrl("https://admin.domain.com/businesses")).toBe(
      "https://admin.domain.com/login?next=https%3A%2F%2Fadmin.domain.com%2Fbusinesses",
    );
    expect(loginUrl("https://app.domain.com/ascnd")).toBe("https://app.domain.com/login?next=https%3A%2F%2Fapp.domain.com%2Fascnd");
  });

  it("with the site on app.<root>: the dashboard signs in at /app/login there, the super-admin on admin.", () => {
    mode({ mode: "subdomain", root: "domain.co.uk", site: "https://app.domain.co.uk" });
    expect(loginUrl("/app/ascnd")).toBe("https://app.domain.co.uk/app/login?next=%2Fapp%2Fascnd");
    expect(secondFactorUrl("/app/ascnd")).toBe("https://app.domain.co.uk/app/login/verify?next=%2Fapp%2Fascnd");
    expect(loginUrl("https://admin.domain.co.uk/businesses")).toBe(
      "https://admin.domain.co.uk/login?next=https%3A%2F%2Fadmin.domain.co.uk%2Fbusinesses",
    );
  });

  it("keeps path mode's relative sign-in", () => {
    mode({ mode: "path", root: "localhost:3000", site: "http://localhost:3000" });
    expect(loginUrl("/app/ascnd")).toBe("/app/login?next=%2Fapp%2Fascnd");
  });
});
