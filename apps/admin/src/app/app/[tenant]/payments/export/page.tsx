import type { Metadata } from "next";
import { localDate } from "@leadgen/core/booking/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requireTenant } from "@/lib/auth";
import { appUrl } from "@/lib/urls";
import { OwnersOnly } from "../notices";

export const metadata: Metadata = { title: "Export payments" };

export default async function ExportPaymentsPage({ params }: PageProps<"/app/[tenant]/payments/export">) {
  const { tenant: slug } = await params;
  const { can } = await requireTenant(slug);
  if (!can("money")) return <OwnersOnly />;

  const today = localDate(new Date(), "Europe/London");

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Export for your accountant</CardTitle>
        <CardDescription>
          Every card payment, cash payment and bank transfer between two dates, with refunds and Stripe fees, as a spreadsheet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* A plain GET: the browser saves the file. */}
        <form action={appUrl(`/${slug}/payments/export/download`)} method="get" className="grid gap-4 sm:grid-cols-2">
          <Field label="From" name="from">
            <Input id="from" name="from" type="date" required defaultValue={`${today.slice(0, 7)}-01`} />
          </Field>
          <Field label="To" name="to">
            <Input id="to" name="to" type="date" required defaultValue={today} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="lg">
              Download CSV
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
