"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A header link that marks itself as the page you're on.
export function NavLink({ href, className = "", children }: { href: string; className?: string; children: React.ReactNode }) {
  const current = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`${className} ${current ? "font-medium text-(--fg)" : "text-(--muted) hover:text-(--fg)"}`}
    >
      {children}
    </Link>
  );
}
