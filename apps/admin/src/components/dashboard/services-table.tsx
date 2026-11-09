"use client";

import Link from "next/link";
import { ChevronRight, ImageIcon, Plus } from "lucide-react";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { serviceImageUrl, type EditableService } from "@/lib/pricing-fields";
import { cn } from "@/lib/utils";
import { DragHandle, useReorder } from "./sortable";

// What a service's page still needs before it reads well.
function pageChecklist(s: EditableService) {
  return [
    { label: "Header image", done: Boolean(s.image_path) },
    { label: "Tagline", done: Boolean(s.tagline) },
    { label: "Description", done: Boolean(s.description || s.body) },
    { label: "What's included", done: Boolean(s.includes?.length) },
    { label: "How it works", done: Boolean(s.steps?.length) },
    { label: "Questions", done: Boolean(s.faqs?.length) },
  ];
}

function PageStatus({ service }: { service: EditableService }) {
  const checks = pageChecklist(service);
  const done = checks.filter((c) => c.done).length;
  const missing = checks.filter((c) => !c.done).map((c) => c.label);
  return (
    <div title={missing.length ? `Still to add: ${missing.join(", ")}` : "Page is complete"} className="grid gap-1">
      <div
        role="progressbar"
        aria-label="Page completeness"
        aria-valuemin={0}
        aria-valuemax={checks.length}
        aria-valuenow={done}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", done === checks.length ? "bg-emerald-600" : "bg-primary")}
          style={{ width: `${(done / checks.length) * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {done === checks.length ? "Complete" : `${done} of ${checks.length} done`}
      </span>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "neutral"}>
      <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-emerald-600" : "bg-muted-foreground/60")} />
      {active ? "Live" : "Hidden"}
    </Badge>
  );
}

function Thumb({ service, className }: { service: EditableService; className: string }) {
  const image = serviceImageUrl(service.image_path);
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={cn("shrink-0 rounded-md object-cover", className)} />
  ) : (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground", className)}>
      <ImageIcon className="size-4" />
    </span>
  );
}

// Every service in the order customers see them; the handles change that order.
export function ServicesTable({
  services,
  base,
  readOnly,
  reorder,
}: {
  services: EditableService[];
  base: string;
  readOnly: boolean;
  reorder: (ids: string[]) => Promise<{ message?: string }>;
}) {
  const { order, root, dragging, handle } = useReorder(
    services.map((s) => s.id),
    reorder,
  );
  const inOrder = order.flatMap((id) => services.filter((s) => s.id === id));
  const canMove = !readOnly && services.length > 1;

  if (!services.length) {
    return (
      <EmptyState
        title="No services yet"
        action={
          !readOnly && (
            <Link href={`${base}/services/new`} className={buttonVariants()}>
              <Plus /> Add a service
            </Link>
          )
        }
      >
        Add your first service to start taking bookings.
      </EmptyState>
    );
  }
  return (
    <div ref={root}>
      {/* Phones: one card per service. */}
      <ul className="grid gap-3 md:hidden">
        {inOrder.map((s) => (
          <li key={s.id} data-sort-id={s.id} className={cn("flex items-center gap-1", dragging === s.id && "opacity-60")}>
            {canMove && <DragHandle label={s.name} {...handle(s.id)} />}
            <Link
              href={`${base}/services/${s.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card p-3 transition-colors [contain:inline-size] hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Thumb service={s} className="h-14 w-20" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.name}</span>
                  <StatusBadge active={s.active} />
                </span>
                <span className="block text-sm text-muted-foreground">
                  From {formatPence(s.base_price_pence)} · {formatDuration(s.duration_mins)}
                </span>
                <span className="mt-1.5 block">
                  <PageStatus service={s} />
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {/* Larger screens: a table, every cell a link to the service's page. */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              {canMove && (
                <th scope="col" className="w-10 pl-2">
                  <span className="sr-only">Order</span>
                </th>
              )}
              <th scope="col" className="px-4 py-2.5 font-medium">Service</th>
              <th scope="col" className="px-4 py-2.5 font-medium">From</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Takes</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Page</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="w-10 px-2 py-2.5">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {inOrder.map((s) => {
              const href = `${base}/services/${s.id}`;
              const cell = "block px-4 py-3";
              return (
                <tr
                  key={s.id}
                  data-sort-id={s.id}
                  className={cn("group transition-colors hover:bg-muted/40", dragging === s.id && "bg-muted/60 opacity-60")}
                >
                  {canMove && (
                    <td className="pl-2">
                      <DragHandle label={s.name} {...handle(s.id)} />
                    </td>
                  )}
                  <td>
                    <Link
                      href={href}
                      className={cn(cell, "flex items-center gap-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
                    >
                      <Thumb service={s} className="h-10 w-16" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium">
                          {s.name}
                          {s.badge && <Badge tone="accent">{s.badge}</Badge>}
                        </span>
                        {s.tagline && <span className="block max-w-xs truncate text-xs text-muted-foreground">{s.tagline}</span>}
                      </span>
                    </Link>
                  </td>
                  <td>
                    <Link href={href} tabIndex={-1} className={cn(cell, "tabular-nums")}>
                      {formatPence(s.base_price_pence)}
                    </Link>
                  </td>
                  <td>
                    <Link href={href} tabIndex={-1} className={cn(cell, "whitespace-nowrap")}>
                      {formatDuration(s.duration_mins)}
                    </Link>
                  </td>
                  <td>
                    <Link href={href} tabIndex={-1} className={cell}>
                      <PageStatus service={s} />
                    </Link>
                  </td>
                  <td>
                    <Link href={href} tabIndex={-1} className={cell}>
                      <StatusBadge active={s.active} />
                    </Link>
                  </td>
                  <td className="px-2 text-muted-foreground">
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
