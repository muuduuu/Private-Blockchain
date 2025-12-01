import { useEffect, useMemo, useState, type ComponentType, type InputHTMLAttributes } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Activity, ThermometerSun, HeartPulse, Gauge } from "lucide-react"
import { ApiService } from "../../services/api"
import { useTransactionStore } from "../../store/transactionStore"
import { useReferenceStore } from "../../store/referenceStore"
import { useToast } from "../Toast"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Label } from "../ui/label"
import { Select } from "../ui/select"
import { Button } from "../ui/button"

const emergencySchema = z.object({
  patientId: z.string().min(3, "Patient ID required"),
  chiefComplaint: z.string().min(8, "Provide key complaint"),
  heartRate: z.number().min(0).max(200),
  bloodPressure: z.string().regex(/^[0-9]{2,3}\/[0-9]{2,3}$/i, "Use 120/80 format"),
  temperature: z.number().min(35).max(42),
  oxygen: z.number().min(70).max(100),
  severity: z.enum(["Cardiac Arrest", "Stroke", "Trauma", "Sepsis", "Other"]),
  providerId: z.string().min(1, "Select ordering provider"),
})

const severityWeights: Record<z.infer<typeof emergencySchema>["severity"], number> = {
  "Cardiac Arrest": 0.98,
  Stroke: 0.9,
  Trauma: 0.85,
  Sepsis: 0.82,
  Other: 0.65,
}

type EmergencyForm = z.infer<typeof emergencySchema>

export function EmergencyPage() {
  const form = useForm<EmergencyForm>({
    resolver: zodResolver(emergencySchema),
    defaultValues: {
      patientId: "",
      chiefComplaint: "",
      bloodPressure: "120/80",
      heartRate: 90,
      temperature: 37,
      oxygen: 98,
      severity: "Other",
      providerId: "",
    },
  })
  const [submitting, setSubmitting] = useState(false)
  const { addTransaction, fetchTransactions } = useTransactionStore()
  const { providers, hydrate } = useReferenceStore()
  const { notify } = useToast()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const watched = form.watch()
  const priorityScore = useMemo(() => {
    let score = severityWeights[watched.severity]
    if (watched.heartRate > 120 || watched.oxygen < 90) score += 0.05
    if (watched.temperature > 39) score += 0.03
    return Number(Math.min(score, 0.99).toFixed(2))
  }, [watched])

  const priorityLabel = priorityScore > 0.9 ? "CRITICAL" : priorityScore > 0.75 ? "HIGH" : "STABLE"
  const priorityColor = priorityScore > 0.9 ? "text-danger" : priorityScore > 0.75 ? "text-warning" : "text-success"

  const onSubmit = async (data: EmergencyForm) => {
    setSubmitting(true)
    try {
      const provider = providers.find((p) => p.id === data.providerId)
      const record = await ApiService.createEmergencyRecord({
        patientId: data.patientId,
        provider: provider?.name ?? data.providerId,
        priority: "Tier-1",
        data: data,
      })
      addTransaction(record)
      fetchTransactions()
      notify({ title: "Critical record sealed", description: `Block ${record.blockHash} confirmed`, variant: "success" })
      form.reset()
    } catch (error) {
      notify({ title: "Submission failed", description: String(error), variant: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tier-1 Critical Records</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">🚨 Emergency Room - Create Critical Record</h2>
        </div>
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-2 text-danger">
          <p className="text-xs uppercase tracking-[0.3em] text-danger">Priority Score</p>
          <p className={`text-2xl font-bold ${priorityColor}`}>
            {priorityScore} {priorityLabel === "CRITICAL" ? "🔴" : priorityLabel === "HIGH" ? "🟠" : "🟢"} {priorityLabel}
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Patient Presentation</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="patientId">Patient ID</Label>
                <Input id="patientId" placeholder="Search CAMTC-1024" {...form.register("patientId")} />
                <FieldError message={form.formState.errors.patientId?.message} />
              </div>
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Select id="provider" {...form.register("providerId")}>
                  <option value="">Select provider</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} — {provider.specialty}
                    </option>
                  ))}
                </Select>
                <FieldError message={form.formState.errors.providerId?.message} />
              </div>
            </div>

            <div>
              <Label htmlFor="chiefComplaint">Chief Complaint</Label>
              <Textarea id="chiefComplaint" rows={3} placeholder="Describe complaint" {...form.register("chiefComplaint")} />
              <FieldError message={form.formState.errors.chiefComplaint?.message} />
            </div>

            <div>
              <Label>Vital Signs</Label>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <VitalInput
                  label="Heart Rate"
                  icon={HeartPulse}
                  suffix="bpm"
                  error={form.formState.errors.heartRate?.message}
                  {...form.register("heartRate", { valueAsNumber: true })}
                />
                <VitalInput
                  label="Blood Pressure"
                  icon={Gauge}
                  suffix="mmHg"
                  error={form.formState.errors.bloodPressure?.message}
                  {...form.register("bloodPressure")}
                />
                <VitalInput
                  label="Temperature"
                  icon={ThermometerSun}
                  suffix="°C"
                  error={form.formState.errors.temperature?.message}
                  {...form.register("temperature", { valueAsNumber: true })}
                />
                <VitalInput
                  label="O2 Saturation"
                  icon={Activity}
                  suffix="%"
                  error={form.formState.errors.oxygen?.message}
                  {...form.register("oxygen", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="severity">Severity Assessment</Label>
                <Select id="severity" {...form.register("severity")}>
                  {Object.keys(severityWeights).map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </Select>
                <FieldError message={form.formState.errors.severity?.message} />
              </div>
              <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
                <AlertTriangle className="mb-2 h-5 w-5" />
                <p>Submitting will broadcast to validators immediately. Confirm criticality before signing.</p>
              </div>
            </div>

            <Button type="submit" variant="danger" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Sealing record..." : "Broadcast Critical Record"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function VitalInput({ label, icon: Icon, suffix, error, ...props }: { label: string; icon: ComponentType<{ className?: string }>; suffix: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon className="h-4 w-4" />
        </span>
        <Input className="pl-10 pr-12" {...props} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>
      </div>
      <FieldError message={error} />
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-danger">{message}</p>
}
