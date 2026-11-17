import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mustChangePassword } from "@leadgen/core/account/password-change";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Change password" };

export default function PasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <PasswordCard />
      </Suspense>
    </main>
  );
}

async function PasswordCard() {
  const user = await requireUser(appUrl("/account/password"));
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Signed in as {user.email}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {(await mustChangePassword(user.id)) ? (
          <PasswordForm />
        ) : (
          // Only for temporary passwords and reset links: see actions.ts.
          <p className="text-sm text-muted-foreground">
            To change your password, open Settings → Account in your dashboard. It asks for your current password first.
          </p>
        )}
        <Link href={appUrl()} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Back to the dashboard
        </Link>
      </CardContent>
    </Card>
  );
}
