"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { MAX_ANSWER, MAX_FAQS, MAX_QUESTION, type Faq } from "@leadgen/core/branding/faq";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Booking page → Questions and answers. Each question is a row;
// drag a row by its handle to change the order (or focus the handle and use
// the arrow keys). The rows are sent in the order they're shown, which is
// the order customers see them.

type Row = Faq & { id: string };

const EXAMPLES = [
  { question: "Do you need water or power at my address?", answer: "e.g. We bring our own water and power, so we just need space around the car." },
  { question: "How long does a valet take?", answer: "e.g. Most valets take two to three hours. We'll give you a time when you book." },
  { question: "What if it rains?", answer: "e.g. We can work in light rain. If it's too wet, we'll move your booking for free." },
];

export function FaqForm({ faqs, action, readOnly }: { faqs: Faq[]; action: Action; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => faqs.map((f) => ({ ...f, id: crypto.randomUUID() })));
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const list = useRef<HTMLOListElement>(null);
  // The row just added, to put the cursor in its question.
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    if (!focusNext.current) return;
    list.current?.querySelector<HTMLInputElement>(`[data-row="${focusNext.current}"] input`)?.focus();
    focusNext.current = null;
  }, [rows]);

  // Rows moved by dragging or the keyboard aren't typed into, so the Save
  // button is told the form changed (it listens for input events).
  const order = rows.map((r) => r.id).join();
  // Set by a move until it has been drawn, so a drag never measures rows
  // that are about to change places.
  const moving = useRef(false);
  useEffect(() => {
    moving.current = false;
    list.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [order]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    moving.current = true;
    setRows((r) => {
      const next = [...r];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
    setAnnouncement(`Moved to position ${to + 1} of ${rows.length}.`);
  };

  // While dragging: swap with the row above or below once the pointer passes
  // its middle, and scroll the page when the pointer nears the screen's edge.
  function dragTo(clientY: number) {
    if (!dragging || !list.current || moving.current) return;
    const from = rows.findIndex((r) => r.id === dragging);
    const items = [...list.current.children] as HTMLElement[];
    const middle = (i: number) => {
      const box = items[i].getBoundingClientRect();
      return box.top + box.height / 2;
    };
    if (from > 0 && clientY < middle(from - 1)) move(from, from - 1);
    else if (from < rows.length - 1 && clientY > middle(from + 1)) move(from, from + 1);
    const edge = 64;
    if (clientY < edge) window.scrollBy(0, -12);
    else if (clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }

  const add = () => {
    const id = crypto.randomUUID();
    focusNext.current = id;
    setRows((r) => [...r, { id, question: "", answer: "" }]);
  };
  const update = (id: string, patch: Partial<Faq>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <div className="grid gap-4">
          {rows.length > 0 ? (
            <ol ref={list} className="grid gap-3" aria-label="Questions, in the order customers see them">
              {rows.map((row, i) => {
                const example = EXAMPLES[i % EXAMPLES.length];
                const isDragged = dragging === row.id;
                return (
                  <li
                    key={row.id}
                    data-row={row.id}
                    className={cn(
                      "flex gap-2 rounded-lg border bg-card p-3 transition-shadow",
                      isDragged && "relative z-10 shadow-lg ring-2 ring-primary/40",
                    )}
                  >
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`Question ${i + 1} of ${rows.length}. Drag, or press the up and down arrow keys, to move it`}
                        className={cn(
                          "-my-1 -ml-1 grid w-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          isDragged && "cursor-grabbing bg-muted text-foreground",
                        )}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setDragging(row.id);
                        }}
                        onPointerMove={(e) => dragTo(e.clientY)}
                        onPointerUp={() => setDragging(null)}
                        onPointerCancel={() => setDragging(null)}
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                          e.preventDefault();
                          move(i, e.key === "ArrowUp" ? i - 1 : i + 1);
                          // Keep the keyboard on the handle as it moves.
                          requestAnimationFrame(() =>
                            list.current?.querySelector<HTMLButtonElement>(`[data-row="${row.id}"] button`)?.focus(),
                          );
                        }}
                      >
                        <GripVertical className="size-4" aria-hidden />
                      </button>
                    )}
                    <div className="grid min-w-0 flex-1 gap-3">
                      <Field label={`Question ${i + 1}`} name={`question_${i}`} error={errors[`question_${i}`]}>
                        <Input
                          name="question"
                          value={row.question}
                          onChange={(e) => update(row.id, { question: e.target.value })}
                          maxLength={MAX_QUESTION}
                          placeholder={`e.g. ${example.question}`}
                        />
                      </Field>
                      <Field label="Answer" name={`answer_${i}`} error={errors[`answer_${i}`]}>
                        <Textarea
                          name="answer"
                          rows={3}
                          value={row.answer}
                          onChange={(e) => update(row.id, { answer: e.target.value })}
                          maxLength={MAX_ANSWER}
                          placeholder={example.answer}
                        />
                      </Field>
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                        aria-label={`Remove question ${i + 1}`}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No questions yet. Answer the ones customers ask you most, like whether you need water or power, how long a
              job takes and what happens if it rains.
            </p>
          )}
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="lg" onClick={add} disabled={rows.length >= MAX_FAQS}>
                <Plus aria-hidden /> Add a question
              </Button>
              <p className="text-xs text-muted-foreground">
                {rows.length >= MAX_FAQS
                  ? `That's the most you can have (${MAX_FAQS}).`
                  : rows.length > 1
                    ? "Drag the handle to change the order. Blank rows are left out."
                    : `Up to ${MAX_FAQS}. Blank rows are left out.`}
              </p>
            </div>
          )}
        </div>
      )}
    </SaveForm>
  );
}
