import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Circular icon badge shared by every card and the settings tiles,
// so icons carry the same shape, size and tint across the dashboard.
/** Renders the shared circular icon treatment used by dashboard cards. */
export function IconChip({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [&_svg]:size-4",
        className
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}
