import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, needsSecondFactor } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { loginUrl } from "@/lib/urls";
import { signOut } from "../../actions";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Enter your code" };

export default function VerifyPage({ searchParams }: PageProps<"/app/login/verify">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Enter your code</CardTitle>
          <CardDescription>Open your authenticator app and type the 6-digit code it shows for this account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Suspense fallback={<div className="h-32" />}>
            <Step searchParams={searchParams} />
          </Suspense>
          <p className="text-sm text-muted-foreground">Lost your phone? Contact us and we&apos;ll check it&apos;s you, then reset this.</p>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="-ml-2">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

async function Step({ searchParams }: { searchParams: PageProps<"/app/login/verify">["searchParams"] }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (!(await getCurrentUser())) redirect(loginUrl(target));
  // Already done, or two-factor isn't on: nothing to ask for.
  if (!(await needsSecondFactor())) redirect(target);
  return <VerifyForm next={target} />;
}
