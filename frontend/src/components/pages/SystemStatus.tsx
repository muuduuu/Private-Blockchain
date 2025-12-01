import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ServerCog, Activity } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useMetricsStore } from "../../store/metricsStore"
import type { ValidatorNode } from "../../types"
import { cn } from "../../lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"

export function SystemStatusPage() {
  const { metrics, validators, systemLogs, fetchMetrics, refreshValidators, pushSystemLog } = useMetricsStore()
  const [selectedValidator, setSelectedValidator] = useState<ValidatorNode | null>(null)

  useEffect(() => {
    fetchMetrics()
    refreshValidators()
  }, [fetchMetrics, refreshValidators])

  useEffect(() => {
    const interval = setInterval(() => {
      pushSystemLog({
        timestamp: new Date().toISOString(),
        level: Math.random() > 0.8 ? "warning" : "info",
        message: Math.random() > 0.5 ? "Validator heartbeat received" : "Sync committee rotation complete",
      })
    }, 8000)
    return () => clearInterval(interval)
  }, [pushSystemLog])

  const reputationHistogram = useMemo(() => validators.map((node) => ({ name: node.id, reputation: node.reputation * 100 })), [validators])
  const blockRate = useMemo(
    () =>
      Array.from({ length: 7 }, (_, idx) => ({
        day: `Day ${idx + 1}`,
        blocks: 600 + Math.random() * 80,
        throughput: 30 + Math.random() * 10,
      })),
    [validators.length],
  )

  const consensusActive = (metrics?.currentTps ?? 0) > 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">⚙ System Status - Network Health</h2>
        <Badge label={consensusActive ? "Consensus Active" : "Stalled"} variant={consensusActive ? "success" : "danger"} />
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricBlock label="Nodes Online" value={validators.length} icon={<ServerCog className="h-5 w-5 text-primary" />} />
        <MetricBlock label="Consensus" value={consensusActive ? "Active" : "Stalled"} icon={<Activity className="h-5 w-5 text-success" />} />
        <MetricBlock label="Block Height" value={(metrics?.totalBlocks ?? 0).toLocaleString()} />
        <MetricBlock label="Avg Block Time" value={`${Math.max(450, metrics?.networkLatency ?? 450)} ms`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validator Fleet</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm text-slate-700 dark:text-slate-100">
            <thead>
              <tr className="bg-slate-100/80 text-xs uppercase tracking-[0.3em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">Tier</th>
                <th className="px-3 py-3 text-left">Reputation</th>
                <th className="px-3 py-3 text-left">Blocks Proposed</th>
                <th className="px-3 py-3 text-left">Uptime</th>
                <th className="px-3 py-3 text-left">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {validators.map((node) => (
                <tr
                  key={node.id}
                  className={cn(
                    "cursor-pointer border-b border-slate-200/70 hover:bg-slate-100 dark:border-white/5 dark:hover:bg-white/5",
                    rowColor(node.reputation),
                  )}
                  onClick={() => setSelectedValidator(node)}
                >
                  <td className="px-3 py-3">{node.id}</td>
                  <td className="px-3 py-3">{node.tier}</td>
                  <td className="px-3 py-3">{node.reputation}</td>
                  <td className="px-3 py-3">{node.blocksProposed}</td>
                  <td className="px-3 py-3">{node.uptime}%</td>
                  <td className="px-3 py-3">{new Date(node.lastSeen).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Validator Reputation Histogram</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reputationHistogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0f172a" }} />
                <Bar dataKey="reputation" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Block Creation Rate</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={blockRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0f172a" }} />
                <Line type="monotone" dataKey="blocks" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Network Throughput (7d)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={blockRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0f172a" }} />
                <Line type="monotone" dataKey="throughput" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
        </CardHeader>
        <CardContent className="max-h-72 space-y-3 overflow-y-auto">
          {systemLogs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className="rounded-lg border border-slate-200/70 bg-slate-50 px-3 py-2 text-xs dark:border-white/5 dark:bg-white/5"
            >
              <span className="text-slate-500 dark:text-slate-400">{new Date(log.timestamp).toLocaleTimeString()} • {log.level.toUpperCase()}</span>
              <p className="text-slate-900 dark:text-white">{log.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedValidator && <ValidatorModal validator={selectedValidator} onClose={() => setSelectedValidator(null)} />}
    </div>
  )
}

function MetricBlock({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  )
}

function rowColor(reputation: number) {
  if (reputation > 0.8) return "bg-success/5"
  if (reputation > 0.5) return "bg-warning/5"
  return "bg-danger/5"
}

function ValidatorModal({ validator, onClose }: { validator: ValidatorNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6 backdrop-blur">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200/70 bg-white p-6 text-slate-900 transition-colors dark:border-white/10 dark:bg-slate-900 dark:text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Validator Detail</p>
            <h3 className="text-2xl font-semibold">{validator.id}</h3>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Info label="Tier" value={validator.tier} />
          <Info label="Reputation" value={validator.reputation.toString()} />
          <Info label="Blocks Proposed" value={validator.blocksProposed.toString()} />
          <Info label="Uptime" value={`${validator.uptime}%`} />
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/70 p-3 dark:border-white/10">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
