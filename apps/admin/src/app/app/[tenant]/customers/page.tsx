import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAccess } from "@/lib/auth";
import { formatDate, formatPhone } from "@leadgen/core/customer-fields";
import { PAGE_SIZE, listCustomers } from "@/lib/customers";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/customers">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAccess(slug, "customers.view");

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { customers, total } = await listCustomers(tenant.id, { q, page });

  const base = appUrl(`/${slug}/customers`);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) =>
    `${base}?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Customers"
          description="Everyone who has booked or enquired, with their marketing preferences."
        />
        <Link href={`${base}/new`} className={buttonVariants({ size: "lg" })}>
          <Plus />
          Add customer
        </Link>
      </div>

      <Form action={base} className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search name, email, phone or postcode"
          aria-label="Search customers"
          className="h-9 pl-8"
        />
      </Form>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {q ? (
            <>No customers match &ldquo;{q}&rdquo;.</>
          ) : (
            <>
              No customers yet. They&apos;ll be added automatically from
              bookings, or{" "}
              <Link href={`${base}/new`} className="underline underline-offset-4">
                add one yourself
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Postcode</th>
                <th className="px-4 py-2 font-medium">Marketing</th>
                <th className="px-4 py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map((c) => {
                const channels = [
                  c.email_marketing && "Email",
                  c.sms_marketing && "SMS",
                  c.whatsapp_marketing && "WhatsApp",
                ].filter(Boolean);
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`${base}/${c.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid">
                        {c.email && <span className="truncate">{c.email}</span>}
                        {c.phone && (
                          <span className="text-muted-foreground">
                            {formatPhone(c.phone)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.postcode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {channels.length ? channels.join(", ") : "None"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <nav
          aria-label="Pages"
          className="mt-4 flex items-center justify-between text-sm text-muted-foreground"
        >
          <span>
            {total} {total === 1 ? "customer" : "customers"}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
                Previous
              </PageLink>
              <span>
                Page {page} of {pageCount}
              </span>
              <PageLink href={pageHref(page + 1)} disabled={page >= pageCount}>
                Next
              </PageLink>
            </div>
          )}
        </nav>
      )}
    </>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = buttonVariants({ variant: "outline", size: "sm" });
  return disabled ? (
    <span aria-disabled className={cn(className, "pointer-events-none opacity-50")}>
      {children}
    </span>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
