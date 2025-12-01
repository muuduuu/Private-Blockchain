import { Fragment, useEffect, useMemo, useState } from "react"
import { Download, Wifi, ChevronDown } from "lucide-react"
import { useTransactionStore } from "../../store/transactionStore"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { useWebSocket } from "../../hooks/useWebSocket"

const actions = ["Create", "Read", "Update", "Delete"]
const outcomes = ["success", "failed", "blocked"] as const

type Outcome = (typeof outcomes)[number]

export function AuditLogPage() {
  const { auditLog, fetchAuditLog } = useTransactionStore()
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set())
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<Outcome>>(new Set(outcomes))
  const [userId, setUserId] = useState("")
  const [patientId, setPatientId] = useState("")
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const wsUrl = import.meta.env.VITE_WS_URL ? `${import.meta.env.VITE_WS_URL}/ws/audit-log` : undefined
  const { status } = useWebSocket(wsUrl)

  useEffect(() => {
    fetchAuditLog()
  }, [fetchAuditLog])

  const filtered = useMemo(() => {
    return auditLog.filter((entry) => {
      if (selectedActions.size && !selectedActions.has(entry.action)) return false
      if (selectedOutcomes.size && !selectedOutcomes.has(entry.outcome)) return false
      if (userId && !entry.userId.toLowerCase().includes(userId.toLowerCase())) return false
      if (patientId && !entry.patientId.toLowerCase().includes(patientId.toLowerCase())) return false
      if (fromDate && new Date(entry.timestamp) < new Date(fromDate)) return false
      if (toDate && new Date(entry.timestamp) > new Date(toDate)) return false
      return true
    })
  }, [auditLog, selectedActions, selectedOutcomes, userId, patientId, fromDate, toDate])

  const toggleAction = (action: string) => {
    setSelectedActions((current) => {
      const next = new Set(current)
      if (next.has(action)) next.delete(action)
      else next.add(action)
      return next
    })
  }

  const toggleOutcome = (outcome: Outcome) => {
    setSelectedOutcomes((current) => {
      const next = new Set(current)
      if (next.has(outcome)) next.delete(outcome)
      else next.add(outcome)
      return next
    })
  }

  const downloadCsv = () => {
    const header = "Timestamp,Action,User,Patient,IP,Outcome,BlockHash"
    const rows = filtered.map((entry) =>
      [entry.timestamp, entry.action, entry.userId, entry.patientId, entry.ipAddress, entry.outcome, entry.blockHash].join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "audit-log.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-white">🔐 Audit Log - Compliance Dashboard</h2>
        <div className="flex items-center gap-3">
          <Badge
            label={status === "connected" ? "New entries" : status === "mock" ? "Simulated" : "Offline"}
            variant={status === "connected" ? "success" : status === "mock" ? "warning" : "danger"}
          />
          <Wifi className={`h-5 w-5 ${status === "connected" ? "text-success" : "text-slate-500"}`} />
          <Button variant="outline" onClick={downloadCsv}>
            <Download className="mr-2 h-4 w-4" /> Download as CSV
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filter Access Events</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Date Range</p>
            <div className="mt-3 flex flex-col gap-3">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Action Type</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => toggleAction(action)}
                  className={`rounded-full px-3 py-1 text-xs ${selectedActions.has(action) ? "bg-primary text-white" : "bg-white/5 text-slate-300"}`}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">User / Provider ID</p>
            <Input className="mt-3" value={userId} onChange={(event) => setUserId(event.target.value)} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Patient ID</p>
            <Input className="mt-3" value={patientId} onChange={(event) => setPatientId(event.target.value)} />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Access Outcome</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {outcomes.map((outcome) => (
                <label key={outcome} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedOutcomes.has(outcome)} onChange={() => toggleOutcome(outcome)} />
                  {outcome}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm text-slate-100">
            <thead>
              <tr className="bg-white/5 text-xs uppercase tracking-[0.3em] text-slate-400">
                <th className="px-3 py-3 text-left">Timestamp</th>
                <th className="px-3 py-3 text-left">Action</th>
                <th className="px-3 py-3 text-left">User ID</th>
                <th className="px-3 py-3 text-left">Patient ID</th>
                <th className="px-3 py-3 text-left">IP Address</th>
                <th className="px-3 py-3 text-left">Outcome</th>
                <th className="px-3 py-3 text-left">Block Hash</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    className="cursor-pointer border-b border-white/5 hover:bg-white/5"
                    onClick={() => setExpandedRow((current) => (current === entry.id ? null : entry.id))}
                  >
                    <td className="px-3 py-3">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-3">{entry.action}</td>
                    <td className="px-3 py-3">{entry.userId}</td>
                    <td className="px-3 py-3">{entry.patientId}</td>
                    <td className="px-3 py-3">{entry.ipAddress}</td>
                    <td className="px-3 py-3">
                      <Badge
                        label={entry.outcome}
                        variant={entry.outcome === "success" ? "success" : entry.outcome === "failed" ? "danger" : "warning"}
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{entry.blockHash.slice(0, 12)}...</td>
                  </tr>
                  {expandedRow === entry.id && (
                    <tr>
                      <td colSpan={7} className="bg-slate-900/80 px-6 py-4 text-xs text-slate-300">
                        <div className="flex items-center justify-between">
                          <p>{entry.details}</p>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
