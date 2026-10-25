"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

// A value in a box with a copy button: for the temporary password, the
// booking address and the embed snippet.
export function CopyText({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-muted/40 px-2.5 py-1.5 text-sm whitespace-nowrap">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard blocked: the value is still selectable above.
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
