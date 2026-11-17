"use client";

import { useCallback, useEffect, useRef } from "react";

// The browser half of the bot check (Cloudflare Turnstile; the server half is
// @leadgen/core/turnstile). Invisible unless Cloudflare wants the visitor to
// tick a box, in which case it appears in the element `ref` is put on. With
// no site key set it does nothing and getToken() gives null, which the server
// accepts while its secret isn't set either.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<void> | null = null;
function loadScript() {
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function useHumanCheck() {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const waiting = useRef<((token: string | null) => void) | null>(null);

  const settle = useCallback((token: string | null) => {
    waiting.current?.(token);
    waiting.current = null;
  }, []);

  useEffect(() => {
    if (!SITE_KEY) return;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !ref.current || !window.turnstile) return;
        widget.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => settle(token),
          "error-callback": () => {
            settle(null);
            return true;
          },
          "expired-callback": () => settle(null),
        });
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [settle]);

  // A fresh, single-use token for the next server call.
  const getToken = useCallback((): Promise<string | null> => {
    const t = window.turnstile;
    const id = widget.current;
    if (!SITE_KEY || !t || !id) return Promise.resolve(null);
    return new Promise((resolve) => {
      settle(null);
      waiting.current = resolve;
      t.reset(id);
      t.execute(id);
      // Gives up after a minute, so a stuck check can't hang the form.
      setTimeout(() => {
        if (waiting.current === resolve) settle(null);
      }, 60_000);
    });
  }, [settle]);

  return { ref, getToken };
}
