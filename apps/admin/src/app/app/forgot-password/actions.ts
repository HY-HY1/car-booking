"use server";

import { after } from "next/server";
import { z } from "zod";
import { sendPasswordReset } from "@leadgen/core/account/password-reset";

export type ForgotState = { error?: string; sent?: boolean };

// The email goes after the response, so the answer is the same and takes the
// same time whether or not the address has an account.
export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter your email address." };

  after(() => sendPasswordReset(email.data).catch((error) => console.error("Password reset failed", error)));
  return { sent: true };
}
