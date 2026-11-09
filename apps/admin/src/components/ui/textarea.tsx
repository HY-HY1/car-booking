import * as React from "react"
import { cn } from "cn"
import { controlClass } from "./control"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(controlClass, "block py-2", className)} {...props} />
}

export { Textarea }
