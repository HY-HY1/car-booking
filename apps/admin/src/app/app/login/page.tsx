import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Manage your bookings, leads and customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Suspense fallback={<div className="h-52" />}>
            <LoginForm />
          </Suspense>
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href={appUrl("/signup")} className="underline underline-offset-4">
              Start your free trial
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
