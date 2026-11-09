import * as React from "react"
import { PRODUCT_NAME } from "@/lib/brand"

// The page shown when something's missing or has gone wrong. `brand` adds the
// product name above it, for when there's no dashboard around it.
function StatusPage({
  code,
  title,
  brand,
  actions,
  children,
}: {
  code?: string
  title: string
  brand?: boolean
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      {brand && <p className="mb-10 text-lg font-semibold tracking-tight">{PRODUCT_NAME}</p>}
      {code && <p className="font-mono text-sm text-muted-foreground">{code}</p>}
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="mt-2 max-w-sm text-sm text-muted-foreground">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </main>
  )
}

export { StatusPage }
