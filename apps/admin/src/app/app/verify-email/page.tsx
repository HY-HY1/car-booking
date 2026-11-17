import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { emailCheckDone } from "@leadgen/core/account/email-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { appUrl } from "@/lib/urls";
import { continueAction, resendAction } from "./actions";
import { VerifyButton } from "./verify-form";

export const metadata: Metadata = { title: "Confirm your email" };

// Where the dashboard sends a new owner who hasn't pressed the link in our
// email yet (lib/auth.ts requireTenant).
export default function VerifyEmailPage({ searchParams }: PageProps<"/app/verify-email">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <VerifyCard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function VerifyCard({ searchParams }: { searchParams: PageProps<"/app/verify-email">["searchParams"] }) {
  const { next } = await searchParams;
  const target = safeNext(typeof next === "string" ? next : undefined);
  const user = await requireUser(appUrl("/verify-email"));
  // Done already, and the session agrees: nothing to do here.
  const done = await emailCheckDone(user.id);
  if (done && !user.emailUnchecked) redirect(target);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{done ? "Email confirmed" : "Confirm your email"}</CardTitle>
        <CardDescription>
          {done
            ? "Thanks. Your dashboard is ready."
            : `We've sent a link to ${user.email ?? "your email address"}. Press it to open your dashboard.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <VerifyButton
          action={continueAction.bind(null, target)}
          label={done ? "Open my dashboard" : "I've confirmed it"}
          pendingLabel="Checking…"
        />
        {!done && <VerifyButton action={resendAction} label="Send the link again" pendingLabel="Sending…" variant="outline" />}
      </CardContent>
    </Card>
  );
}
