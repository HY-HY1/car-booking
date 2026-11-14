"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type RefObject } from "react";
import { askToConfirm } from "@/components/ui/confirm-dialog";

// Warns before leaving a page with unsaved changes, however you leave: a link,
// the back button, reloading or closing the tab. A form counts as changed when
// what it would submit differs from when it was last saved, so nothing has to
// report edits, and undoing an edit clears the warning.

declare global {
  interface Window {
    __onPopState?: (event: PopStateEvent) => void;
  }
}

type Router = ReturnType<typeof useRouter>;

const forms = new Set<() => boolean>();
let router: Router | null = null;
let page = "";
// Going ahead: nothing should stop the navigation under way.
let leaving = false;
// The next popstate is our own step forward, undoing the one we blocked.
let undoingBack = false;

const hasChanges = () => [...forms].some((changed) => changed());
const here = () => location.pathname + location.search;

function confirmLeaving() {
  return askToConfirm({
    title: "Leave without saving?",
    description: "Your changes on this page haven't been saved.",
    confirmLabel: "Leave without saving",
    cancelLabel: "Keep editing",
    destructive: true,
  });
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (leaving || !hasChanges()) return;
  event.preventDefault();
  event.returnValue = "";
}

// Runs before the framework sees the click, so it can stop a link.
function onClick(event: MouseEvent) {
  if (leaving || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
  const url = new URL(link.href);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  // A jump to a section of this same page.
  if (url.origin === location.origin && url.pathname + url.search === here()) return;
  if (!hasChanges()) return;

  event.preventDefault();
  event.stopPropagation();
  void confirmLeaving().then((leave) => {
    if (!leave) return;
    leaving = true;
    if (url.origin === location.origin) router?.push(url.pathname + url.search + url.hash);
    else location.assign(url);
  });
}

// Called from HISTORY_GUARD_SCRIPT, ahead of the router. The address has
// already changed by the time this runs, so the step is undone and then taken
// again if they do want to go.
function onPopState(event: PopStateEvent) {
  if (undoingBack) {
    undoingBack = false;
    event.stopImmediatePropagation();
    return;
  }
  if (leaving || here() === page || !hasChanges()) return;

  event.stopImmediatePropagation();
  undoingBack = true;
  history.go(1);
  // In case there was nothing to step forward to.
  window.setTimeout(() => {
    undoingBack = false;
  }, 1000);
  void confirmLeaving().then((leave) => {
    if (!leave) return;
    leaving = true;
    history.back();
  });
}

function watch(changed: () => boolean, currentRouter: Router) {
  if (forms.size === 0) {
    leaving = false;
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.__onPopState = onPopState;
  }
  forms.add(changed);
  router = currentRouter;
  page = here();

  return () => {
    forms.delete(changed);
    if (forms.size > 0) return;
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("click", onClick, true);
    window.__onPopState = undefined;
  };
}

function snapshot(form: HTMLFormElement) {
  return JSON.stringify(
    [...new FormData(form).entries()].map(([name, value]) => [
      name,
      value instanceof File ? `${value.name}:${value.size}` : value,
    ]),
  );
}

function savedNow(form: RefObject<HTMLFormElement | null>, saved: { current: string | null }) {
  return () => {
    if (form.current) saved.current = snapshot(form.current);
  };
}

// Watches a form until it unmounts. Returns the function to call once it's saved.
export function useUnsavedChanges(form: RefObject<HTMLFormElement | null>, enabled = true) {
  return useChangeTracking(form, enabled).markSaved;
}

// As useUnsavedChanges, and also says whether the form has changed since it
// was last saved, kept up to date as it's edited (Save buttons use it).
export function useChangeTracking(form: RefObject<HTMLFormElement | null>, enabled = true) {
  const currentRouter = useRouter();
  const [saved] = useState<{ current: string | null }>({ current: null });
  const [changed, setChanged] = useState(false);

  // Made once: the form ref and the saved snapshot holder never change.
  const [mark] = useState(() => savedNow(form, saved));
  const [isChanged] = useState(
    () => () => form.current !== null && saved.current !== null && snapshot(form.current) !== saved.current,
  );
  const [markSaved] = useState(() => () => {
    mark();
    setChanged(false);
  });

  useEffect(() => {
    if (!enabled) return;
    // Only the first time: the router keeps a page's state when you leave, so
    // anything unsaved is still there, and still unsaved, when you come back.
    if (saved.current === null) mark();
    const timer = window.setTimeout(() => setChanged(isChanged()), 0);
    const unwatch = watch(isChanged, currentRouter);
    return () => {
      window.clearTimeout(timer);
      unwatch();
    };
  }, [enabled, saved, mark, isChanged, currentRouter]);

  // Checked after each edit. A beat later, so fields React fills in from
  // state (hidden inputs, a colour picker's text box) have caught up.
  useEffect(() => {
    const el = form.current;
    if (!enabled || !el) return;
    let timer: number | undefined;
    const check = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setChanged(isChanged()), 0);
    };
    const events = ["input", "change", "click", "pointerup", "keyup", "reset"] as const;
    for (const name of events) el.addEventListener(name, check);
    return () => {
      window.clearTimeout(timer);
      for (const name of events) el.removeEventListener(name, check);
    };
  }, [enabled, form, isChanged]);

  return { markSaved, changed, recheck: () => setChanged(isChanged()) };
}
