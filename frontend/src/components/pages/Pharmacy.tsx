import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pill, ShieldAlert } from "lucide-react"
import { ApiService } from "../../services/api"
import { useTransactionStore } from "../../store/transactionStore"
import { useReferenceStore } from "../../store/referenceStore"
import { useToast } from "../Toast"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"

const prescriptionSchema = z.object({
  patientId: z.string().min(3),
  medication: z.string().min(2),
  dosage: z.number().positive(),
  unit: z.enum(["mg", "ml", "units"]),
  frequency: z.string().min(2),
  quantity: z.number().int().positive(),
  refills: z.number().int().min(0).max(11),
  provider: z.string().min(2),
  instructions: z.string().optional(),
  controlled: z.boolean(),
})

type PrescriptionForm = z.infer<typeof prescriptionSchema>

const frequencies = ["Once daily", "BID", "TID", "QID", "As needed"]
const medications = ["Atorvastatin", "Metformin", "Lisinopril", "Amoxicillin", "Insulin glargine"]

export function PharmacyPage() {
  const form = useForm<PrescriptionForm>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      patientId: "",
      medication: medications[0],
      dosage: 25,
      unit: "mg",
      frequency: frequencies[0],
      quantity: 30,
      refills: 1,
      provider: "",
      instructions: "Take with food",
      controlled: false,
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const { addTransaction } = useTransactionStore()
  const { providers, patientIds, hydrate } = useReferenceStore()
  const { notify } = useToast()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (patientIds.length > 0 && !form.getValues("patientId")) {
      form.setValue("patientId", patientIds[0]!)
    }
  }, [patientIds, form])

  useEffect(() => {
    if (providers.length > 0 && !form.getValues("provider")) {
      form.setValue("provider", providers[0]!.name)
    }
  }, [providers, form])

  const watchAll = form.watch()
  const priority = useMemo(() => {
    let score = 0.55
    if (watchAll.controlled) score += 0.25
    if (watchAll.frequency === "QID") score += 0.05
    return Number(Math.min(score, 0.95).toFixed(2))
  }, [watchAll])

  const priorityLabel = priority > 0.8 ? "🟥 CRITICAL" : priority > 0.65 ? "🟠 URGENT" : "🟢 ROUTINE"

  const onSubmit = async (values: PrescriptionForm) => {
    setSubmitting(true)
    try {
      const tx = await ApiService.createPrescription({
        patientId: values.patientId,
        provider: values.provider,
        priority: values.controlled ? "Tier-2" : "Tier-3",
        data: values,
      })
      addTransaction(tx)
      notify({ title: "Prescription issued", description: `Tx ${tx.id} confirmed`, variant: "success" })
      form.reset()
    } catch (error) {
      notify({ title: "Unable to issue prescription", description: String(error), variant: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-white">💊 Pharmacy - Issue Prescription</h2>
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-warning">
          Priority: {priority} {priorityLabel}
        </div>
      </div>

      {watchAll.controlled && (
        <div className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-danger">
          <ShieldAlert className="mr-2 inline h-4 w-4" /> Controlled substance detected. DEA check required.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prescription Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Patient ID</Label>
                <Select {...form.register("patientId")}>
                  {patientIds.map((patient) => (
                    <option key={patient} value={patient}>
                      {patient}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Provider / Prescriber</Label>
                <Select {...form.register("provider")}>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.name}>
                      {provider.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Medication</Label>
                <Select {...form.register("medication")}>
                  {medications.map((med) => (
                    <option key={med} value={med}>
                      {med}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Dosage</Label>
                <div className="flex gap-3">
                  <Input type="number" min={1} {...form.register("dosage", { valueAsNumber: true })} />
                  <Select className="w-32" {...form.register("unit")}>
                    <option value="mg">mg</option>
                    <option value="ml">ml</option>
                    <option value="units">units</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Frequency</Label>
                <Select {...form.register("frequency")}>
                  {frequencies.map((freq) => (
                    <option key={freq} value={freq}>
                      {freq}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" {...form.register("quantity", { valueAsNumber: true })} />
              </div>
              <div>
                <Label>Refills</Label>
                <Input type="number" min={0} max={11} {...form.register("refills", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="controlled" className="h-4 w-4" {...form.register("controlled")} />
              <Label htmlFor="controlled" className="normal-case tracking-normal">
                Controlled Substance
              </Label>
            </div>

            <div>
              <Label>Instructions / Notes</Label>
              <Textarea rows={3} {...form.register("instructions")} />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              <Pill className="mr-2 h-4 w-4" /> {submitting ? "Submitting..." : "Issue Prescription"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
