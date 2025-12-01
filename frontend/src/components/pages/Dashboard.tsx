import { useEffect } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Legend,
} from "recharts"
import { useMetricsStore } from "../../store/metricsStore"
import { cn } from "../../lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { LoadingSpinner } from "../LoadingSpinner"
import { Badge } from "../ui/badge"

export function DashboardPage() {
  const { metrics, fetchMetrics, loading } = useMetricsStore()

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 12_000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  if (!metrics && loading) {
    return <LoadingSpinner label="Syncing metrics" className="py-16" />
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Validators" value={metrics?.validatorsActive ?? 0} pill="Tiered" color="text-primary" />
        <MetricCard label="Current TPS" value={metrics?.currentTps ?? 0} suffix=" tx/s" color="text-success" />
        <MetricCard label="Network Latency" value={metrics?.networkLatency ?? 0} suffix=" ms" color="text-warning" />
        <MetricCard label="Total Blocks" value={metrics?.totalBlocks ?? 0} color="text-purple-400" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              TPS Over Last 24 Hours <Badge label="Live" variant="success" />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics?.tpsTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timestamp" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0f172a", borderRadius: 12, border: "1px solid #1e293b" }} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics?.transactionDistribution ?? []}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {(metrics?.transactionDistribution ?? []).map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", borderRadius: 12, border: "1px solid #1e293b" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Validator Reputation Scores</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics?.validatorScores ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#0f172a", borderRadius: 12, border: "1px solid #1e293b" }} />
              <Legend />
              <Bar dataKey="value" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: number
  suffix?: string
  pill?: string
  color?: string
}

function MetricCard({ label, value, suffix = "", pill, color = "text-white" }: MetricCardProps) {
  return (
    <Card className="border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/40">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <p className={cn("text-3xl font-bold", color)}>
          {value.toLocaleString()} {suffix}
        </p>
        {pill && <Badge label={pill} />}
      </CardContent>
    </Card>
  )
}

