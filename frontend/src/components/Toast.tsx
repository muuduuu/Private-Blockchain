import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "../lib/utils"

type ToastVariant = "success" | "error" | "warning" | "info"

export interface ToastConfig {
  id?: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  notify: (config: ToastConfig) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const variantClasses: Record<ToastVariant, string> = {
  success: "border-success bg-success/10",
  error: "border-danger bg-danger/10",
  warning: "border-warning bg-warning/10",
  info: "border-primary bg-primary/10",
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Required<ToastConfig>[]>([])

  const notify = useCallback((toast: ToastConfig) => {
    const generatedId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
    const id = toast.id ?? generatedId
    const payload: Required<ToastConfig> = {
      id,
      duration: toast.duration ?? 6000,
      variant: toast.variant ?? "info",
      title: toast.title,
      description: toast.description ?? "",
    }
    setToasts((current) => [payload, ...current])
    if (payload.duration > 0) {
      setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id))
      }, payload.duration)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 mx-auto flex w-full max-w-sm flex-col gap-3 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-lg border px-4 py-3 shadow-lg shadow-slate-950/30",
              variantClasses[toast.variant],
            )}
          >
            <div className="flex items-start gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{toast.title}</p>
                {toast.description && <p className="text-xs text-slate-200">{toast.description}</p>}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-slate-100 transition hover:text-white"
                aria-label="Dismiss toast"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return ctx
}
