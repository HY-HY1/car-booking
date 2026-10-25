"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// A type-to-filter dropdown, like Autotrader's make and model pickers.
// Typing "merc" finds Mercedes-Benz, "id3" finds ID.3. Follows the ARIA
// combobox pattern so it works with a keyboard and screen readers.

export type OptionGroup = { label?: string; options: string[] };

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function search(groups: OptionGroup[], query: string) {
  const q = normalise(query);
  const all = [...new Set(groups.flatMap((g) => g.options))];
  const hits = all.filter((o) => normalise(o).includes(q));
  // Best matches first: those starting with what was typed, then the rest.
  return [...hits.filter((o) => normalise(o).startsWith(q)), ...hits.filter((o) => !normalise(o).startsWith(q))];
}

export function SearchSelect({
  label,
  groups,
  value,
  onChange,
  placeholder,
  disabled,
  extraOption,
}: {
  label: string;
  groups: OptionGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  // Always listed last, whatever is typed: e.g. "Other (not listed)".
  extraOption?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const shown: OptionGroup[] = query.trim() ? [{ options: search(groups, query) }] : groups;
  const flat = [...shown.flatMap((g) => g.options), ...(extraOption ? [extraOption] : [])];

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const choose = (option: string) => {
    onChange(option);
    setQuery("");
    setOpen(false);
  };

  const openList = () => {
    if (disabled) return;
    setActive(Math.max(0, flat.indexOf(value)));
    setOpen(true);
  };

  // Position of each group's first option in the flat list.
  const starts = shown.map((_, g) => shown.slice(0, g).reduce((n, grp) => n + grp.options.length, 0));

  const optionItem = (option: string, i: number) => {
    return (
      <li
        key={`${option}-${i}`}
        id={`${id}-${i}`}
        role="option"
        aria-selected={i === active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(option)}
        onMouseEnter={() => setActive(i)}
        className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 ${
          i === active ? "bg-neutral-100" : ""
        } ${option === extraOption ? "border-t text-neutral-600" : ""}`}
      >
        <span>{option}</span>
        {option === value && <Check className="size-4 text-brand" />}
      </li>
    );
  };

  return (
    <div className="grid gap-1.5 text-sm">
      <label htmlFor={`${id}-input`}>{label}</label>
      <div className="relative">
        <input
          ref={input}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && flat.length ? `${id}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : value}
          placeholder={open && value ? value : placeholder}
          onFocus={openList}
          onClick={openList}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openList();
              else setActive((a) => Math.min(a + 1, flat.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && flat[active]) {
              e.preventDefault();
              choose(flat[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          className="w-full rounded-xl border border-neutral-300 bg-white py-2.5 pr-10 pl-3 text-base outline-none placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-neutral-100 disabled:text-neutral-400"
        />
        <ChevronDown
          aria-hidden
          className={`pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
        {open && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white text-base shadow-lg"
          >
            {shown.map((group, g) => (
              <li key={g} role="presentation">
                {group.label && (
                  <div className="sticky top-0 bg-neutral-50 px-3 py-1.5 text-xs font-medium tracking-wide text-neutral-500 uppercase">
                    {group.label}
                  </div>
                )}
                <ul role="presentation">{group.options.map((o, j) => optionItem(o, starts[g] + j))}</ul>
              </li>
            ))}
            {query.trim() && flat.length === (extraOption ? 1 : 0) && (
              <li role="presentation" className="px-3 py-2.5 text-neutral-500">
                No matches for &ldquo;{query.trim()}&rdquo;
              </li>
            )}
            {extraOption && <ul role="presentation">{optionItem(extraOption, flat.length - 1)}</ul>}
          </ul>
        )}
      </div>
    </div>
  );
}
