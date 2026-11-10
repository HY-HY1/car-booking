import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appUrl } from "@/lib/urls";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgotten password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Forgotten your password?</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send you a link to choose a new one.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ForgotForm />
          <Link href={appUrl("/login")} className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
