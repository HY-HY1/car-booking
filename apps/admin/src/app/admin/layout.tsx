import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/platform";
import { signOut } from "@/app/app/actions";
import { adminUrl, appUrl } from "@/lib/urls";

export default function PlatformLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<div className="h-14 border-b" />}>
        <Header />
      </Suspense>
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

async function Header() {
  const user = await requirePlatformAdmin();
  return (
    <header className="border-b bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-8">
        <Link href={adminUrl()} className="font-semibold">
          Platform admin
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href={adminUrl()} className="text-sidebar-foreground/70 hover:text-sidebar-foreground">
            Businesses
          </Link>
          <Link href={appUrl()} className="text-sidebar-foreground/70 hover:text-sidebar-foreground">
            My dashboards
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
          <ThemeToggle />
          <Link href={adminUrl("/new")} className={buttonVariants({ size: "sm" })}>
            New business
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
