import * as React from "react"
import { cn } from "../../lib/utils"

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-11 w-full rounded-md border border-slate-200/70 bg-white px-3 text-sm text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10 dark:bg-white/5 dark:text-white",
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = "Select"

export { Select }
