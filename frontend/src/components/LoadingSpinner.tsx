import { cn } from "../lib/utils"

interface LoadingSpinnerProps {
  label?: string
  className?: string
}

export function LoadingSpinner({ label = "Loading", className }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 text-primary", className)}>
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
    </div>
  )
}
