import { useState } from "react"
import { NavLink } from "react-router-dom"
import {
  Activity,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Pill,
  ServerCog,
  ShieldAlert,
  Stethoscope,
} from "lucide-react"
import { cn } from "../lib/utils"

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Emergency", path: "/emergency", icon: ShieldAlert },
  { label: "Pharmacy", path: "/pharmacy", icon: Pill },
  { label: "Lab Results", path: "/lab-results", icon: Stethoscope },
  { label: "Vital Signs", path: "/vital-signs", icon: HeartPulse },
  { label: "Patient Records", path: "/patient-records", icon: FileText },
  { label: "Audit Log", path: "/audit-log", icon: Activity },
  { label: "System Status", path: "/system-status", icon: ServerCog },
]

interface SidebarProps {
  onToggle?: (open: boolean) => void
}

export function Sidebar({ onToggle }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      onToggle?.(next)
      return next
    })
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-slate-200/60 bg-white/90 px-2 py-6 text-slate-900 backdrop-blur-lg transition-colors dark:border-white/5 dark:bg-slate-900/80 dark:text-white",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="mx-auto mb-6 rounded-full border border-slate-200/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500 transition-colors dark:border-white/10 dark:text-slate-400"
      >
        {collapsed ? "Expand" : "Collapse"}
      </button>

      <nav className="flex flex-1 flex-col gap-2">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  collapsed ? "justify-center" : "justify-start",
                  isActive
                    ? "bg-primary/15 text-primary dark:bg-primary/20 dark:text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {!collapsed && item.label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
