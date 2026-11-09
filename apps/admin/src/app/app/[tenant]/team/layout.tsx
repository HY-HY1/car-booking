import { PageHeader } from "@/components/dashboard/page-header";
import { PageTabs } from "@/components/dashboard/page-tabs";

// The people in the business, in two lists that are easy to mix up: who does
// the work, and who can log in.
export default async function TeamLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]/team">) {
  const { tenant: slug } = await params;
  return (
    <>
      <PageHeader title="Team" />
      <PageTabs
        base={`/${slug}/team`}
        tabs={[
          { path: "", label: "Staff" },
          { path: "/access", label: "Logins & access" },
        ]}
      />
      {children}
    </>
  );
}
