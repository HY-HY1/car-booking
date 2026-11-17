import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmAction } from "../actions";
import { VerifyButton } from "../verify-form";

export const metadata: Metadata = { title: "Confirm your email" };

// The link in the sign-up email. Opening it changes nothing: mail scanners
// open links without anyone clicking, so it waits for the button.
export default function ConfirmEmailPage({ searchParams }: PageProps<"/app/verify-email/confirm">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Confirm your email</CardTitle>
          <CardDescription>One press and your dashboard is open.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-11" />}>
            <Confirm searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function Confirm({ searchParams }: { searchParams: PageProps<"/app/verify-email/confirm">["searchParams"] }) {
  const { u, t } = await searchParams;
  const action = confirmAction.bind(null, typeof u === "string" ? u : "", typeof t === "string" ? t : "");
  return <VerifyButton action={action} label="Confirm my email" pendingLabel="Confirming…" />;
}
