import { Skeleton } from "@/components/ui/skeleton";

// Placeholders shown while a dashboard page loads, shaped like what's coming
// so nothing jumps when it arrives.

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-label="Loading" className="grid gap-6">
      {children}
    </div>
  );
}

export function TitleSkeleton() {
  return <Skeleton className="h-8 w-48 rounded-lg" />;
}

function Rows({ count }: { count: number }) {
  return (
    <div className="divide-y rounded-xl border">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 shrink-0 sm:block" />
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function Fields({ count }: { count: number }) {
  return (
    <div className="grid max-w-2xl gap-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-11 w-24 rounded-lg" />
    </div>
  );
}

// A list page. Leave the title out where the layout already draws one.
export function ListSkeleton({ title = true, rows = 8 }: { title?: boolean; rows?: number }) {
  return (
    <Loading>
      {title && <TitleSkeleton />}
      <Rows count={rows} />
    </Loading>
  );
}

// A form page. Leave the title out where the layout already draws one.
export function FormSkeleton({ title = true, fields = 5 }: { title?: boolean; fields?: number }) {
  return (
    <Loading>
      {title && <TitleSkeleton />}
      <Fields count={fields} />
    </Loading>
  );
}

export function DetailSkeleton() {
  return (
    <Loading>
      <div className="grid gap-2">
        <Skeleton className="h-4 w-20" />
        <TitleSkeleton />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </Loading>
  );
}

export function OverviewSkeleton() {
  return (
    <Loading>
      <TitleSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <Skeleton className="h-11 rounded-lg" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </Loading>
  );
}

export function DiarySkeleton() {
  return (
    <Loading>
      <TitleSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
      <Skeleton className="h-[32rem] rounded-xl" />
    </Loading>
  );
}

export function MapSkeleton() {
  return (
    <Loading>
      <TitleSkeleton />
      <Skeleton className="h-96 rounded-xl" />
      <Rows count={2} />
    </Loading>
  );
}
