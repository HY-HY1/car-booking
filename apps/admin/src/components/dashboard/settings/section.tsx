import { cn } from "@/lib/utils";

// One part of a Settings tab: a heading and what it's for, beside the card
// that holds it when there's room (the tab is a size container), above it
// when there isn't. `wide` keeps the heading above at every size, for
// content that needs the full width (a live preview, a table).

export function SettingsSection({
  id,
  title,
  description,
  badge,
  wide,
  bare,
  className,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  // Beside the title: a status such as Connected or Coming soon.
  badge?: React.ReactNode;
  wide?: boolean;
  // No card around the content (it brings its own, like a list of cards).
  bare?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "grid scroll-mt-6 gap-3",
        !wide && "@3xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @3xl:gap-x-10",
        className,
      )}
    >
      <div className={cn("grid content-start gap-1", !wide && "@3xl:pt-1")}>
        <h2 id={`${id}-title`} className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight">
          {title}
          {badge}
        </h2>
        {description && <div className="max-w-prose text-sm text-muted-foreground">{description}</div>}
      </div>
      {bare ? (
        <div className="@container min-w-0">{children}</div>
      ) : (
        <div className="@container min-w-0 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 sm:p-6">{children}</div>
      )}
    </section>
  );
}

// Above a tab's sections, for people who can look but not change anything.
export function ReadOnlyNotice() {
  return (
    <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
      Your access level lets you see these settings but not change them.
    </p>
  );
}

// The sections of a tab, evenly spaced.
export function SettingsStack({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-8 @3xl:gap-10">{children}</div>;
}

// A thin rule between groups inside one card.
export function Divider() {
  return <hr className="-mx-4 border-border sm:-mx-6" />;
}
