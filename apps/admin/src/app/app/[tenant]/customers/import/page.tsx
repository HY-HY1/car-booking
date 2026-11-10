import type { Metadata } from "next";
import { ImportCustomersForm } from "@/components/dashboard/import-customers-form";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { appUrl } from "@/lib/urls";
import { importCustomersAction } from "./actions";

export const metadata: Metadata = { title: "Import customers" };

export default async function ImportCustomersPage({ params }: PageProps<"/app/[tenant]/customers/import">) {
  const { tenant: slug } = await params;
  await requireAccess(slug, "customers.delete");

  return (
    <>
      <BackLink href={appUrl(`/${slug}/customers`)}>Customers</BackLink>
      <PageHeader title="Import customers" description="Bring in your customer list from a spreadsheet saved as CSV." />
      <Card className="max-w-2xl">
        <CardContent className="grid gap-4 text-sm">
          <p>
            The first line needs column names: <code className="rounded bg-muted px-1">name</code> and at least one of{" "}
            <code className="rounded bg-muted px-1">email</code> or <code className="rounded bg-muted px-1">phone</code>. You can also include{" "}
            <code className="rounded bg-muted px-1">address</code>, <code className="rounded bg-muted px-1">postcode</code> and{" "}
            <code className="rounded bg-muted px-1">notes</code>.
          </p>
          <p className="text-muted-foreground">
            Anyone you already have is left as they are. Everyone comes in opted out of marketing, because a spreadsheet isn&apos;t proof they agreed to it.
          </p>
          <ImportCustomersForm action={importCustomersAction.bind(null, slug)} />
        </CardContent>
      </Card>
    </>
  );
}
