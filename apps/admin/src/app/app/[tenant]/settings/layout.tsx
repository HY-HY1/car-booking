import { SaveFormDefaults } from "@/components/dashboard/form-kit";
import { SettingsHeading, SettingsNav } from "@/components/dashboard/settings-nav";
import { requireTenant } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Every Settings tab: the menu down the side (a dropdown on a phone), the
// tab's own heading, and its sections. The content is a size container, so
// sections lay out by the room they have, whatever the sidebars take.
// Forms here only offer Save once something has changed.
export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]/settings">) {
  const { tenant: slug } = await params;
  const { role, can } = await requireTenant(slug);
  // Technicians only have their own account here, so nothing to choose between.
  const nav = can("settings.view");
  return (
    <SaveFormDefaults requireChanges footer>
      <div
        className={
          nav
            ? "grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-8"
            : "grid gap-6 lg:gap-8"
        }
      >
        <div className={nav ? "lg:col-start-2" : undefined}>
          <SettingsHeading slug={slug} />
        </div>
        {nav && (
          <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <SettingsNav slug={slug} role={role} />
          </div>
        )}
        <div className={cn("@container min-w-0 max-w-6xl", nav && "lg:col-start-2")}>{children}</div>
      </div>
    </SaveFormDefaults>
  );
}
