"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The webhook confirms the booking a moment after Stripe sends the customer
// back. Re-reads the page every couple of seconds until it does.
export function RefreshWhileWaiting() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries > 30) clearInterval(timer);
      else router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
