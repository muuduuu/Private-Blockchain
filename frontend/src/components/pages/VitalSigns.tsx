import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { HeartPulse, Activity, Thermometer, ShieldAlert } from "lucide-react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { MockReferenceData } from "../../services/api"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { useToast } from "../Toast"
import { useWebSocket } from "../../hooks/useWebSocket"

interface VitalForm {
  heartRate: number
  bloodPressure: string
  temperature: number
  oxygen: number
}

const baseVitals = {
  heartRate: 120,
  bloodPressure: "150/95",
  temperature: 37.5,
  oxygen: 88,
}

export function VitalSignsPage() {
  const [patient, setPatient] = useState(MockReferenceData.patients[2] ?? "CAMTC-1002")
  const [vitals, setVitals] = useState(baseVitals)
  const { notify } = useToast()
  const wsUrl = import.meta.env.VITE_WS_URL ? `${import.meta.env.VITE_WS_URL}/ws/vitals/${patient}` : undefined
  const { status } = useWebSocket(wsUrl)

  const form = useForm<VitalForm>({
    defaultValues: baseVitals,
  })

  const alerts = useMemo(() => {
    const badges = [] as string[]
    if (vitals.heartRate > 110) badges.push("⚠ High Heart Rate")
    if (vitals.oxygen < 92) badges.push("🔴 Low Oxygen")
    if (parseInt(vitals.bloodPressure.split("/")[0] ?? "0", 10) > 140) badges.push("⚠ Elevated BP")
    return badges
  }, [vitals])

  const trendData = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => ({
      timestamp: `${idx + 1}h ago`,
      heartRate: 90 + Math.random() * 40,
      oxygen: 88 + Math.random() * 8,
      temperature: 36 + Math.random() * 2,
      systolic: 120 + Math.random() * 25,
    }))
  }, [patient])

  const onSubmit = (values: VitalForm) => {
    setVitals(values)
    notify({ title: "Vitals captured", description: `New set recorded for ${patient}`, variant: "success" })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Real-time monitoring</p>
          <h2 className="text-2xl font-semibold text-white">💓 Vital Signs Monitor</h2>
        </div>
        <Badge
          label={status === "connected" ? "WebSocket Live" : status === "mock" ? "Simulated" : "Disconnected"}
          variant={status === "connected" ? "success" : status === "mock" ? "warning" : "danger"}
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Patient Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Patient ID</Label>
          <Input list="patient-options" value={patient} onChange={(event) => setPatient(event.target.value)} />
          <datalist id="patient-options">
            {MockReferenceData.patients.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <VitalCard label="HR" value={`${vitals.heartRate} bpm`} icon={HeartPulse} alert={vitals.heartRate > 110} color="text-warning" />
        <VitalCard label="BP" value={vitals.bloodPressure} icon={ShieldAlert} alert color="text-primary" />
        <VitalCard label="Temp" value={`${vitals.temperature} °C`} icon={Thermometer} color="text-success" />
        <VitalCard label="O2" value={`${vitals.oxygen}%`} icon={Activity} alert={vitals.oxygen < 92} color="text-danger" />
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {alerts.map((alert) => (
            <Badge key={alert} label={alert} variant={alert.includes("Low") ? "danger" : "warning"} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart title="Heart Rate" dataKey="heartRate" data={trendData} color="#F59E0B" />
        <TrendChart title="Oxygen" dataKey="oxygen" data={trendData} color="#EF4444" />
        <TrendChart title="Temperature" dataKey="temperature" data={trendData} color="#10B981" />
        <TrendChart title="Systolic" dataKey="systolic" data={trendData} color="#3B82F6" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record New Vital Signs</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <div>
              <Label>Heart Rate (bpm)</Label>
              <Input type="number" {...form.register("heartRate", { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Blood Pressure</Label>
              <Input {...form.register("bloodPressure")} />
            </div>
            <div>
              <Label>Temperature (°C)</Label>
              <Input type="number" step={0.1} {...form.register("temperature", { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Oxygen (%)</Label>
              <Input type="number" {...form.register("oxygen", { valueAsNumber: true })} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full">
                Push Update to Chain
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

interface VitalCardProps {
  label: string
  value: string
  icon: typeof HeartPulse
  alert?: boolean
  color?: string
}

function VitalCard({ label, value, icon: Icon, alert = false, color = "text-white" }: VitalCardProps) {
  return (
    <Card className={alert ? "border-danger/40" : undefined}>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
          <p className={`text-3xl font-semibold ${color}`}>{value}</p>
        </div>
        <Icon className={`h-10 w-10 ${color}`} />
      </CardContent>
    </Card>
  )
}

interface TrendChartProps {
  title: string
  dataKey: string
  data: Array<Record<string, number | string>>
  color: string
}

function TrendChart({ title, dataKey, data, color }: TrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title} (6h)</CardTitle>
      </CardHeader>
      <CardContent className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="timestamp" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
