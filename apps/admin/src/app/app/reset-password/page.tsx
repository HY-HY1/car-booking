import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appUrl } from "@/lib/urls";
import { confirmPasswordReset } from "./actions";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset your password" };

// Opening the emailed link changes nothing: the token is only spent by the
// button, so a mail scanner following the link can't use it up.
export default function ResetPasswordPage({ searchParams }: PageProps<"/app/reset-password">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Continue to choose a new password.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Suspense fallback={<div className="h-11" />}>
            <Form searchParams={searchParams} />
          </Suspense>
          <Link href={appUrl("/forgot-password")} className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Ask for a new link
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/app/reset-password">["searchParams"] }) {
  const { token } = await searchParams;
  return <ResetForm action={confirmPasswordReset.bind(null, typeof token === "string" ? token : "")} />;
}
