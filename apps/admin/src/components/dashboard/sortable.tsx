"use client";

import { useRef, useState, useTransition, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Putting a list in order by dragging, or with the arrow keys on the handle.
// The list moves as you go and saves when you let go; if the save fails it
// goes back.

type Save = (ids: string[]) => Promise<{ message?: string }>;

// How close to the window's edge a drag scrolls the page.
const SCROLL_EDGE = 64;
// Quiet after the last arrow key press before saving.
const KEYBOARD_SAVE_MS = 500;

export function useReorder(ids: string[], save: Save) {
  const [order, setOrder] = useState(ids);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, startSaving] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const keyboard = useRef<{ timer: number; before: string[] } | null>(null);

  // Added or deleted on the server: take the server's list.
  const key = ids.join();
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setOrder(ids);
  }

  function commit(next: string[], before: string[]) {
    if (next.join() === before.join()) return;
    startSaving(async () => {
      let problem: string | undefined;
      try {
        problem = (await save(next)).message;
      } catch {
        problem = "Couldn't save the new order. Check your connection and try again.";
      }
      if (problem) {
        toast.error(problem);
        setOrder(before);
      } else {
        toast.success("Order saved");
      }
    });
  }

  function pickUp(event: ReactPointerEvent, id: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    const before = order;
    let current = order;
    let pointerY = event.clientY;
    let frame = 0;
    setDragging(id);

    // Goes in front of the first other row whose middle is below the pointer.
    const place = () => {
      const others = [...(root.current?.querySelectorAll<HTMLElement>("[data-sort-id]") ?? [])].filter(
        (row) => row.offsetParent !== null && row.dataset.sortId !== id,
      );
      let index = others.findIndex((row) => {
        const box = row.getBoundingClientRect();
        return pointerY < box.top + box.height / 2;
      });
      if (index === -1) index = others.length;
      const next = others.map((row) => row.dataset.sortId as string);
      next.splice(index, 0, id);
      if (next.join() === current.join()) return;
      current = next;
      setOrder(next);
    };
    const scrollAtEdges = () => {
      const by = pointerY < SCROLL_EDGE ? -10 : pointerY > window.innerHeight - SCROLL_EDGE ? 10 : 0;
      if (by) {
        window.scrollBy(0, by);
        place();
      }
      frame = requestAnimationFrame(scrollAtEdges);
    };

    const onMove = (e: PointerEvent) => {
      pointerY = e.clientY;
      place();
    };
    const finish = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      setDragging(null);
    };
    const onUp = () => {
      finish();
      commit(current, before);
    };
    const onCancel = () => {
      finish();
      setOrder(before);
    };
    const onKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    frame = requestAnimationFrame(scrollAtEdges);
  }

  function nudge(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const from = order.indexOf(id);
    const to = from + step;
    if (to < 0 || to >= order.length) return;

    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    setOrder(next);

    // Moving a row can take focus off its handle.
    const handle = event.currentTarget;
    requestAnimationFrame(() => handle.focus());

    const before = keyboard.current?.before ?? order;
    if (keyboard.current) window.clearTimeout(keyboard.current.timer);
    keyboard.current = {
      before,
      timer: window.setTimeout(() => {
        keyboard.current = null;
        commit(next, before);
      }, KEYBOARD_SAVE_MS),
    };
  }

  return {
    order,
    root,
    dragging,
    handle: (id: string) => ({
      onPointerDown: (event: ReactPointerEvent) => pickUp(event, id),
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => nudge(event, id),
    }),
  };
}

export function DragHandle({ label, ...props }: { label: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={`Move ${label}. Use the up and down arrow keys.`}
      title="Drag to reorder"
      className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing md:size-8"
      {...props}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

// A plain stack of rows, each with a handle beside it.
export function SortableRows({
  items,
  save,
  readOnly,
}: {
  items: { id: string; label: string; content: ReactNode }[];
  save: Save;
  readOnly: boolean;
}) {
  const { order, root, dragging, handle } = useReorder(
    items.map((i) => i.id),
    save,
  );
  const canMove = !readOnly && items.length > 1;

  return (
    <div ref={root} className="grid gap-3">
      {order.flatMap((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return [];
        return [
          <div key={id} data-sort-id={id} className={cn("flex items-start gap-1", dragging === id && "opacity-60")}>
            {canMove && (
              <div className="pt-1.5 md:pt-3">
                <DragHandle label={item.label} {...handle(id)} />
              </div>
            )}
            <div className="min-w-0 flex-1">{item.content}</div>
          </div>,
        ];
      })}
    </div>
  );
}
