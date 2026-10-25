import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <PasswordForm />
        <Link href={appUrl()} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Back to the dashboard
        </Link>
      </CardContent>
    </Card>
  );
}
