import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDate } from "@leadgen/core/dates";
import { listLogins, type Login } from "@leadgen/core/platform/logins";
import { ROLES } from "@leadgen/core/team/access";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/platform/action-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requirePlatformAdmin } from "@/lib/platform";
import { ago } from "@/lib/platform-format";
import { adminUrl } from "@/lib/urls";
import { resetLoginTwoFactorAction, setBlockedAction } from "./actions";

export const metadata: Metadata = { title: "Logins" };

const SHOW = {
  all: "Everyone",
  no2fa: "No two-factor",
  never: "Never signed in",
  temporary: "Still on a temporary password",
  orphan: "On no business",
  blocked: "Blocked",
  admins: "Platform admins",
} as const;
type Show = keyof typeof SHOW;

const matches: Record<Show, (l: Login) => boolean> = {
  all: () => true,
  no2fa: (l) => !l.twoFactor,
  never: (l) => !l.lastSignInAt,
  temporary: (l) => l.temporaryPassword,
  orphan: (l) => l.businesses.length === 0 && !l.platformAdmin,
  blocked: (l) => Boolean(l.blockedUntil),
  admins: (l) => l.platformAdmin,
};

export default function LoginsPage({ searchParams }: PageProps<"/admin/logins">) {
  return (
    <>
      <PageHeader title="Logins" description="Everyone who can sign in, across every business." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Logins searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Logins({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePlatformAdmin(adminUrl("/logins"));
  const [all, sp] = await Promise.all([listLogins(), searchParams]);
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 100) : "";
  const show: Show = typeof sp.show === "string" && sp.show in SHOW ? (sp.show as Show) : "all";
  const shown = all.filter(
    (l) => matches[show](l) && (!q || l.email.toLowerCase().includes(q) || l.businesses.some((b) => b.name.toLowerCase().includes(q) || b.slug.includes(q))),
  );

  const without2fa = all.filter((l) => !l.twoFactor).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge>{all.length} logins</Badge>
        <Badge tone={without2fa ? "warning" : "success"}>
          {all.length - without2fa} with two-factor ({all.length ? Math.round(((all.length - without2fa) / all.length) * 100) : 0}%)
        </Badge>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Email or business" />
        </div>
        <Select name="show" defaultValue={show} aria-label="Show" className="w-60">
          {Object.entries(SHOW).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {(q || show !== "all") && (
          <Link href={adminUrl("/logins")} className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        )}
      </form>

      {shown.length === 0 ? (
        <EmptyState compact>Nobody matches.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Login</th>
                <th className="px-4 py-2 font-medium">Businesses</th>
                <th className="px-4 py-2 font-medium">Last signed in</th>
                <th className="px-4 py-2 font-medium">Security</th>
                <th className="px-4 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-4 py-3">
                    <span className="block font-medium break-all">{l.email}</span>
                    <span className="text-xs text-muted-foreground">Since {formatDate(l.createdAt)}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {l.id === me.id && <Badge>You</Badge>}
                      {l.platformAdmin && <Badge tone="violet">Platform admin</Badge>}
                      {l.blockedUntil && <Badge tone="danger">Blocked</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {l.businesses.length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      l.businesses.map((b) => (
                        <span key={b.slug} className="block">
                          <Link href={adminUrl(`/businesses/${b.slug}`)} className="underline-offset-4 hover:underline">
                            {b.name}
                          </Link>
                          <span className="text-xs text-muted-foreground"> · {ROLES[b.role as keyof typeof ROLES]?.label ?? b.role}</span>
                        </span>
                      ))
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{l.lastSignInAt ? ago(l.lastSignInAt) : <span className="text-muted-foreground">Never</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={l.twoFactor ? "success" : "neutral"}>{l.twoFactor ? "Two-factor on" : "Password only"}</Badge>
                      {!l.emailConfirmed && <Badge tone="warning">Email not confirmed</Badge>}
                      {l.temporaryPassword && <Badge tone="warning">Temporary password</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {l.id !== me.id && (
                      <div className="flex flex-wrap justify-end gap-1">
                        {l.twoFactor && (
                          <ActionButton
                            action={resetLoginTwoFactorAction.bind(null, l.id)}
                            variant="ghost"
                            confirm={{
                              title: `Reset two-factor for ${l.email}?`,
                              description: "Only do this once you're sure it's them: they'll sign in with just their password until they set it up again.",
                              confirmLabel: "Reset",
                              destructive: true,
                            }}
                          >
                            Reset two-factor
                          </ActionButton>
                        )}
                        {!l.platformAdmin &&
                          (l.blockedUntil ? (
                            <ActionButton action={setBlockedAction.bind(null, l.id, false)} variant="ghost">
                              Unblock
                            </ActionButton>
                          ) : (
                            <ActionButton
                              action={setBlockedAction.bind(null, l.id, true)}
                              variant="ghost"
                              confirm={{
                                title: `Block ${l.email}?`,
                                description: "They can't sign in to any business until you unblock them. Use it for a lost or misused account.",
                                confirmLabel: "Block sign-in",
                                destructive: true,
                              }}
                            >
                              Block
                            </ActionButton>
                          ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
