import { cn } from "../../lib/utils"

interface BadgeProps {
  label: string
  variant?: "default" | "success" | "warning" | "danger"
  className?: string
}

export function Badge({ label, variant = "default", className }: BadgeProps) {
  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-primary/20 text-primary",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    danger: "bg-danger/20 text-danger",
  }
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", variants[variant], className)}>{label}</span>
}
