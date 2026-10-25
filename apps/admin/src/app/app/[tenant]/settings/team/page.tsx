import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { can, ROLE_KEYS, ROLE_SUMMARY, ROLES } from "@leadgen/core/team/access";
import { listTeam } from "@leadgen/core/team/members";
import { AddMemberForm, MemberRow } from "@/components/dashboard/settings/team-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { addMemberAction } from "./actions";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Team & access" };

const lastSeen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

export default async function TeamAccessPage({ params }: PageProps<"/app/[tenant]/settings/team">) {
  const { tenant: slug } = await params;
  const { tenant, user, can: allowed } = await requireAccess(slug, "settings.view");
  const canManage = allowed("team.manage");
  const team = await listTeam(tenant.id);

  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Who can log in</CardTitle>
          <CardDescription>
            Everyone has their own login and password, and sees only what their access level allows.{" "}
            {canManage ? "Change a level or remove someone at any time; it applies on their next click." : "Only the owner can change these."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3">
            {team.map((m) => (
              <MemberRow
                key={m.userId}
                slug={slug}
                member={{ ...m, lastSeen: lastSeen(m.lastSignInAt) }}
                isYou={m.userId === user.id}
                canManage={canManage}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Give someone access</CardTitle>
            <CardDescription>
              They get their own login. If they already use this app (for another business, say), they keep their
              password. Want them on the job list too? Add them under{" "}
              <Link href={appUrl(`/${slug}/staff`)} className="underline underline-offset-4">
                Staff / Techs
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddMemberForm action={addMemberAction.bind(null, slug)} loginUrl={appUrl("/login", { absolute: true })} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What each level can do</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-2 pr-3 font-medium" />
                {ROLE_KEYS.map((r) => (
                  <th key={r} className="px-2 py-2 text-center font-medium">
                    {ROLES[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_SUMMARY.map((row) => (
                <tr key={row.label} className="border-t">
                  <td className="py-2 pr-3">{row.label}</td>
                  {ROLE_KEYS.map((r) => (
                    <td key={r} className="px-2 py-2 text-center">
                      {can(r, row.permission) ? (
                        <Check className="mx-auto size-4 text-emerald-600" aria-label="Yes" />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted-foreground" aria-label="No" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Office staff can see settings and prices but not change them. Technicians can mark jobs done or a no-show;
            cancelling a job is for the office.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
