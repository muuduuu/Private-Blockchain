import { useEffect, useState } from "react"
import { Moon, ShieldCheck, Sun, Wallet2 } from "lucide-react"
import { useWeb3 } from "../hooks/useWeb3"
import { cn } from "../lib/utils"

interface NavbarProps {
  networkLabel?: string
}

export function Navbar({ networkLabel = "CAMTC Healthcare Blockchain Network" }: NavbarProps) {
  const { walletAddress, networkStatus, isConnecting, connectWallet, disconnectWallet } = useWeb3()
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("theme") as "light" | "dark") ?? "dark")

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"))

  const statusColor = networkStatus === "connected" ? "bg-success" : "bg-danger"

  return (
    <nav className="flex items-center justify-between border-b border-white/5 bg-slate-900/70 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3 text-white">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Secure Chain Access</p>
          <h1 className="text-xl font-semibold text-white">{networkLabel}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-white">
        <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide">
          <span className={cn("inline-flex h-2 w-2 rounded-full", statusColor)} />
          <span>{networkStatus === "connected" ? "Network Online" : "Wallet Disconnected"}</span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {walletAddress ? (
          <div className="flex items-center gap-2 rounded-full border border-primary/60 bg-primary/20 px-3 py-1 text-sm">
            <Wallet2 className="h-4 w-4" />
            <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            <button
              onClick={disconnectWallet}
              className="text-xs text-slate-200 underline-offset-2 hover:underline"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            <Wallet2 className="h-4 w-4" />
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  )
}
