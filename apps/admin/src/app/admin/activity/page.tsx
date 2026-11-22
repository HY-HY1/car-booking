import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ACTIVITY_AREAS, parseActivityArea } from "@leadgen/core/activity/rules";
import { listPlatformActivity } from "@leadgen/core/platform/activity";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import { Panel } from "@/components/dashboard/overview/panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityList } from "@/components/platform/activity-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { requirePlatformAdmin } from "@/lib/platform";
import { adminUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <>
      <PageHeader title="Activity" description="What's changed across every business, newest first, from each one's activity log." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Activity searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Activity({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin(adminUrl("/activity"));
  const sp = await searchParams;
  const slug = typeof sp.business === "string" ? sp.business : "";
  const area = parseActivityArea(sp.area);
  const page = Math.max(0, Math.min(1000, Number.parseInt(typeof sp.page === "string" ? sp.page : "0", 10) || 0));

  const { data: tenants, error } = await createAdminClient().from("tenants").select("id, name, slug").order("name");
  if (error) throw error;
  const tenant = tenants.find((t) => t.slug === slug) ?? null;
  const { rows, hasMore } = await listPlatformActivity({ tenantId: tenant?.id ?? null, area, page });

  const link = (p: number) => {
    const params = new URLSearchParams();
    if (tenant) params.set("business", tenant.slug);
    if (area) params.set("area", area);
    if (p) params.set("page", String(p));
    const qs = params.toString();
    return adminUrl(`/activity${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="grid gap-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <Select name="business" defaultValue={tenant?.slug ?? ""} aria-label="Business" className="w-60">
          <option value="">Every business</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select name="area" defaultValue={area ?? ""} aria-label="Area" className="w-44">
          <option value="">Everything</option>
          {Object.entries(ACTIVITY_AREAS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {(tenant || area) && (
          <Link href={adminUrl("/activity")} className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        )}
      </form>

      <Panel>
        <ActivityList rows={rows} showBusiness={!tenant} empty="No activity matches." />
      </Panel>

      {(page > 0 || hasMore) && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 0 ? (
            <Link href={link(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">Page {page + 1}</span>
          {hasMore ? (
            <Link href={link(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
