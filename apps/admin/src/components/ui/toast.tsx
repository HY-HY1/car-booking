"use client"

import { Toast } from "@base-ui/react/toast"
import { CircleAlert, CircleCheck, X } from "lucide-react"
import { cn } from "cn"

const manager = Toast.createToastManager()

// Call from anywhere in the browser. Success fades on its own; an error stays
// up longer and is announced straight away.
export const toast = {
  success: (title: string, description?: string) => manager.add({ title, description, type: "success" }),
  error: (title: string, description?: string) =>
    manager.add({ title, description, type: "error", priority: "high", timeout: 8000 }),
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((t) => {
    const Icon = t.type === "error" ? CircleAlert : CircleCheck
    return (
      <Toast.Root
        key={t.id}
        toast={t}
        // Portalled outside the dashboard, so it asks for the brand colours itself.
        data-brand=""
        className="rounded-xl border bg-popover text-popover-foreground shadow-lg transition-all duration-200 data-ending-style:translate-y-1 data-ending-style:opacity-0 data-limited:hidden data-starting-style:translate-y-1 data-starting-style:opacity-0"
      >
        <Toast.Content className="flex items-start gap-2.5 p-3">
          <Icon
            aria-hidden
            className={cn(
              "mt-0.5 size-4 shrink-0",
              t.type === "error" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
            )}
          />
          <div className="min-w-0 flex-1">
            <Toast.Title className="text-sm font-medium" />
            <Toast.Description className="mt-0.5 text-sm text-muted-foreground" />
          </div>
          <Toast.Close
            aria-label="Dismiss"
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    )
  })
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={manager} limit={3}>
      <Toast.Portal>
        {/* The top on phones, clear of the save bar at the bottom of long forms. */}
        <Toast.Viewport className="fixed inset-x-4 top-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:w-96">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
