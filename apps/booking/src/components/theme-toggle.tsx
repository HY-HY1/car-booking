"use client";

import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "@/lib/theme-script";

// Switches the booking pages between light and dark and remembers it
// (lib/theme-script.ts applies the saved choice on the next page load).
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // Not saved; the switch still applies to this page.
    }
  }

  // Both icons are rendered and CSS shows the right one, so the server and
  // the browser agree on the markup whichever mode is on.
  return (
    <button type="button" onClick={toggle} aria-label="Switch between light and dark mode" title="Light or dark mode" className={className}>
      <Moon className="size-4.5 dark:hidden" aria-hidden />
      <Sun className="hidden size-4.5 dark:block" aria-hidden />
    </button>
  );
}
