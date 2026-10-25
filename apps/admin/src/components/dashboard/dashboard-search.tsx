"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Role } from "@leadgen/core/team/access";
import { Input } from "@/components/ui/input";
import { matchPages } from "@/lib/dashboard-pages";
import { liveSearchAction, type LiveResult } from "@/app/app/[tenant]/search/actions";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";

// Search with a dropdown. Pages are matched in the browser as you type;
// customers, bookings and leads are fetched after a short pause. Each row reads
// "Customer: Harvey". Ctrl/Cmd+K focuses it, arrows move, Enter opens the
// highlighted row (or the full results page if none is highlighted).

type Row = { id: string; prefix: string; label: string; detail?: string; href: string };

export function DashboardSearch({
  slug,
  role,
  defaultValue = "",
}: {
  slug: string;
  role: Role;
  defaultValue?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [live, setLive] = useState<{ q: string; rows: LiveResult[] } | null>(null);
  const [failed, setFailed] = useState(false);

  const term = q.trim();
  const base = appUrl(`/${slug}`);

  // Fetch records after a pause; an older answer never overwrites a newer one.
  useEffect(() => {
    if (term.length < 2) return;
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const rows = await liveSearchAction(slug, term);
        if (!stale) {
          setLive({ q: term, rows });
          setFailed(false);
        }
      } catch {
        if (!stale) setFailed(true);
      }
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [slug, term]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const rows: Row[] = useMemo(() => {
    const pages = matchPages(term, role).map((p) => ({
      id: `p-${p.href}`,
      prefix: "Page",
      label: p.label,
      href: base + p.href,
    }));
    const records = live && live.q === term ? live.rows.map((r) => ({ ...r, prefix: r.kind })) : [];
    return [...pages, ...records];
  }, [term, role, base, live]);

  const loading = term.length >= 2 && (!live || live.q !== term) && !failed;
  const showPanel = open && term.length >= 1;
  const results = `${base}/search?q=${encodeURIComponent(term)}`;

  function go(href: string) {
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (rows.length === 0) return;
      // -1 means nothing highlighted, so Enter falls through to the full results.
      setActive((a) =>
        e.key === "ArrowDown" ? (a >= rows.length - 1 ? -1 : a + 1) : a <= -1 ? rows.length - 1 : a - 1,
      );
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && rows[active]) go(rows[active].href);
      else if (term.length >= 2) go(results);
    }
  }

  return (
    <form
      ref={boxRef}
      role="search"
      action={`${base}/search`}
      onSubmit={(e) => e.preventDefault()}
      className="relative mb-6 max-w-md"
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        name="q"
        type="search"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search pages, customers, bookings… (Ctrl K)"
        aria-label="Search the dashboard"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="h-9 pl-8"
      />

      {showPanel && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border bg-popover p-1 text-sm shadow-lg"
        >
          {rows.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(r.href);
              }}
              className={cn(
                "flex cursor-pointer items-baseline gap-1.5 rounded-lg px-3 py-2",
                i === active && "bg-muted",
              )}
            >
              <span className="shrink-0 text-muted-foreground">{r.prefix}:</span>
              <span className="min-w-0 truncate font-medium">{r.label}</span>
              {r.detail && <span className="min-w-0 truncate text-muted-foreground">{r.detail}</span>}
            </li>
          ))}
          {rows.length === 0 && !loading && (
            <li className="px-3 py-2 text-muted-foreground">
              {failed ? "Search isn't working just now." : term.length < 2 ? "Keep typing…" : `Nothing matches “${term}”.`}
            </li>
          )}
          {loading && <li className="px-3 py-2 text-muted-foreground">Searching…</li>}
          {term.length >= 2 && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                go(results);
              }}
              className="cursor-pointer rounded-lg border-t px-3 py-2 text-muted-foreground hover:bg-muted"
            >
              See all results for “{term}”
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
