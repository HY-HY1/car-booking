"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// A block of code with a copy button, optionally under a label such as a file
// name or language.
export function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/60 py-1 pr-1 pl-3">
        <span className="truncate font-mono text-xs text-muted-foreground">{title ?? ""}</span>
        <button
          type="button"
          aria-label={copied ? "Copied" : `Copy ${title ?? "code"}`}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // Clipboard blocked: the code can still be selected by hand.
            }
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
