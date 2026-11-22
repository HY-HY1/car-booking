import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlatformNav } from "@/components/platform/platform-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmHost } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/toast";
import { requirePlatformAdmin } from "@/lib/platform";
import { signOut } from "@/app/app/actions";
import { adminUrl, appUrl } from "@/lib/urls";

export default function PlatformLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<div className="h-24 border-b" />}>
        <Header />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      <ConfirmHost />
      <Toaster />
    </div>
  );
}

async function Header() {
  // Each page checks again, strictly. The header only needs to know who's
  // signed in, so it also shows on the page that sets up two-factor.
  const user = await requirePlatformAdmin(adminUrl(), { setup: true });
  return (
    <header className="border-b bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-3 px-4 py-3 md:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href={adminUrl()} className="font-semibold">
            Platform admin
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Link href={appUrl()} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              My dashboards
            </Link>
            <ThemeToggle />
            <Link href={adminUrl("/new")} className={buttonVariants({ size: "sm" })}>
              New business
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
                <LogOut />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
        <PlatformNav
          links={[
            { href: adminUrl(), label: "Overview", exact: true },
            { href: adminUrl("/businesses"), label: "Businesses" },
            { href: adminUrl("/logins"), label: "Logins" },
            { href: adminUrl("/activity"), label: "Activity" },
            { href: adminUrl("/system"), label: "System" },
          ]}
        />
      </div>
    </header>
  );
}
