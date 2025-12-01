import { useEffect, useMemo, useState } from "react"
import { FlaskConical, Upload } from "lucide-react"
import { ApiService } from "../../services/api"
import { useTransactionStore } from "../../store/transactionStore"
import { useReferenceStore } from "../../store/referenceStore"
import { useToast } from "../Toast"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Textarea } from "../ui/textarea"
import { Button } from "../ui/button"

const manualTests = [
  "CBC",
  "Glucose",
  "COVID-19 PCR",
  "Lipid Panel",
  "Liver Function",
  "Kidney Function",
  "ECG",
  "Chest X-Ray",
]

const statuses = ["Normal", "Abnormal", "Critical"]

interface ManualRow {
  id: string
  testName: string
  value: string
  unit: string
  reference: string
  flag: string
}

const uniqueId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)

export function LabResultsPage() {
  const [tab, setTab] = useState<"upload" | "manual">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [patientId, setPatientId] = useState("")
  const [technician, setTechnician] = useState("")
  const [status, setStatus] = useState(statuses[0])
  const [testType, setTestType] = useState(manualTests[0])
  const [rows, setRows] = useState<ManualRow[]>([
    { id: uniqueId(), testName: "Hemoglobin", value: "13.4", unit: "g/dL", reference: "12-16", flag: "Normal" },
  ])
  const [submitting, setSubmitting] = useState(false)
  const { addTransaction } = useTransactionStore()
  const { patientIds, providers, hydrate } = useReferenceStore()
  const { notify } = useToast()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!patientId && patientIds[0]) {
      setPatientId(patientIds[0]!)
    }
  }, [patientIds, patientId])

  useEffect(() => {
    if (!technician && providers[0]) {
      setTechnician(providers[0]!.name)
    }
  }, [providers, technician])

  const priority = useMemo(() => {
    if (status === "Critical" || testType === "COVID-19 PCR") return "Tier-1"
    if (status === "Abnormal") return "Tier-2"
    return "Tier-3"
  }, [status, testType])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    if (nextFile) setFile(nextFile)
  }

  const addRow = () => {
    setRows((current) => [
      ...current,
      { id: uniqueId(), testName: "", value: "", unit: "", reference: "", flag: "" },
    ])
  }

  const updateRow = (id: string, field: keyof ManualRow, value: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  const submitUpload = async () => {
    if (!file) {
      notify({ title: "Upload missing", description: "Attach a lab file first", variant: "warning" })
      return
    }
    setSubmitting(true)
    try {
      const payload = await ApiService.recordLabResult({
        patientId,
        provider: technician,
        priority,
        data: { mode: "upload", filename: file.name, size: file.size, type: file.type },
      })
      addTransaction(payload)
      notify({ title: "Lab file recorded", description: `Hash ${payload.blockHash}`, variant: "success" })
      setFile(null)
    } catch (error) {
      notify({ title: "Failed to upload", description: String(error), variant: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  const submitManual = async () => {
    setSubmitting(true)
    try {
      const payload = await ApiService.recordLabResult({
        patientId,
        provider: technician,
        priority,
        data: { mode: "manual", testType, status, rows },
      })
      addTransaction(payload)
      notify({ title: "Manual lab result recorded", description: payload.blockHash, variant: "success" })
      setRows([{ id: uniqueId(), testName: "Hemoglobin", value: "13.4", unit: "g/dL", reference: "12-16", flag: "Normal" }])
    } catch (error) {
      notify({ title: "Manual entry failed", description: String(error), variant: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-white">🧪 Lab Results - Upload &amp; Record</h2>
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
          Priority Tier: {priority}
        </div>
      </header>

      <div className="flex gap-4">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "upload" ? "bg-primary text-white" : "bg-white/5 text-slate-300"}`}
          onClick={() => setTab("upload")}
        >
          File Upload
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "manual" ? "bg-primary text-white" : "bg-white/5 text-slate-300"}`}
          onClick={() => setTab("manual")}
        >
          Manual Entry
        </button>
      </div>

      {tab === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-8 text-slate-300"
            >
              <Upload className="mb-3 h-10 w-10 text-primary" />
              <p className="text-sm">Drag &amp; drop PDF or imaging files</p>
              <Input type="file" accept="application/pdf,image/*" className="mt-4" onChange={handleFileChange} />
              {file && <p className="text-xs text-primary">Selected: {file.name}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Patient ID</Label>
                <Select value={patientId} onChange={(event) => setPatientId(event.target.value)}>
                  {patientIds.map((patient) => (
                    <option key={patient} value={patient}>
                      {patient}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Lab Technician</Label>
                <Select value={technician} onChange={(event) => setTechnician(event.target.value)}>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.name}>
                      {provider.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <Button onClick={submitUpload} disabled={submitting} className="w-full" variant="success">
              <Upload className="mr-2 h-4 w-4" /> {submitting ? "Submitting..." : "Submit to Blockchain"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Manual Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Test Type</Label>
                <Select value={testType} onChange={(event) => setTestType(event.target.value)}>
                  {manualTests.map((test) => (
                    <option key={test} value={test}>
                      {test}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Result Status</Label>
                <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {statuses.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full text-sm text-white">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Test Name</th>
                    <th className="px-3 py-2 text-left">Value</th>
                    <th className="px-3 py-2 text-left">Unit</th>
                    <th className="px-3 py-2 text-left">Reference Range</th>
                    <th className="px-3 py-2 text-left">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-white/5">
                      <td className="px-3 py-2">
                        <Input value={row.testName} onChange={(event) => updateRow(row.id, "testName", event.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={row.value} onChange={(event) => updateRow(row.id, "value", event.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={row.unit} onChange={(event) => updateRow(row.id, "unit", event.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={row.reference} onChange={(event) => updateRow(row.id, "reference", event.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={row.flag} onChange={(event) => updateRow(row.id, "flag", event.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button type="button" variant="outline" onClick={addRow}>
              + Add Row
            </Button>

            <div>
              <Label>Notes</Label>
              <Textarea rows={3} placeholder="Enter interpretive notes" />
            </div>

            <Button onClick={submitManual} disabled={submitting} className="w-full">
              <FlaskConical className="mr-2 h-4 w-4" /> {submitting ? "Submitting..." : "Record Manual Result"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
