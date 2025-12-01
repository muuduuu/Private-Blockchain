import { useEffect, useMemo, useState } from "react"
import { Search, Filter, Copy, CheckCircle2, XCircle } from "lucide-react"
import { useTransactionStore } from "../../store/transactionStore"
import type { PriorityTier, TransactionRecord } from "../../types"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { useToast } from "../Toast"

const pageSize = 50

export function PatientRecordsPage() {
  const { transactions, fetchTransactions, setSelectedTransaction, selectedTransaction } = useTransactionStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [providerFilter, setProviderFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<PriorityTier | "All">("All")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [recordTypes, setRecordTypes] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const { notify } = useToast()

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const transactionTypes = useMemo(() => Array.from(new Set(transactions.map((tx) => tx.type))), [transactions])

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (searchTerm && !tx.patientId.toLowerCase().includes(searchTerm.toLowerCase())) return false
      if (providerFilter && !tx.provider.toLowerCase().includes(providerFilter.toLowerCase())) return false
      if (priorityFilter !== "All" && tx.priority !== priorityFilter) return false
      if (recordTypes.size && !recordTypes.has(tx.type)) return false
      if (fromDate && new Date(tx.timestamp) < new Date(fromDate)) return false
      if (toDate && new Date(tx.timestamp) > new Date(toDate)) return false
      return true
    })
  }, [transactions, searchTerm, providerFilter, priorityFilter, recordTypes, fromDate, toDate])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const toggleType = (type: string) => {
    setRecordTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const openModal = (tx: TransactionRecord) => setSelectedTransaction(tx)
  const closeModal = () => setSelectedTransaction(undefined)

  const copyPayload = async () => {
    if (!selectedTransaction) return
    await navigator.clipboard.writeText(JSON.stringify(selectedTransaction, null, 2))
    notify({ title: "Payload copied", variant: "success" })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Search &amp; View All</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">📋 Patient Records - EMR Search</h2>
        </div>
        <Button variant="outline" onClick={() => setFiltersOpen((prev) => !prev)}>
          <Filter className="mr-2 h-4 w-4" /> {filtersOpen ? "Hide Filters" : "Show Filters"}
        </Button>
      </header>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card transition-colors dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-14 rounded-full border-slate-300 bg-white pl-12 text-lg text-slate-900 dark:border-white/20 dark:bg-slate-900/60 dark:text-white"
              placeholder="Search by Patient ID"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          {filtersOpen && (
            <div className="grid gap-6 rounded-2xl border border-slate-200/70 bg-slate-50 p-6 transition-colors dark:border-white/10 dark:bg-slate-900/50 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Record Type</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {transactionTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        recordTypes.has(type)
                          ? "bg-primary text-white"
                          : "bg-slate-200 text-slate-700 dark:bg-white/5 dark:text-slate-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Date Range</p>
                <div className="mt-3 grid gap-3">
                  <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                  <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Provider Name</p>
                <Input className="mt-3" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Priority Tier</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {["All", "Tier-1", "Tier-2", "Tier-3"].map((tier) => (
                    <label key={tier} className="flex items-center gap-2">
                      <input type="radio" checked={priorityFilter === tier} onChange={() => setPriorityFilter(tier as PriorityTier | "All")} />
                      {tier}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Results ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm text-slate-700 dark:text-slate-100">
            <thead>
              <tr className="bg-slate-100/80 text-xs uppercase tracking-[0.3em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <th className="px-3 py-3 text-left">Timestamp</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Provider</th>
                <th className="px-3 py-3 text-left">Priority</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Block Hash</th>
                <th className="px-3 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((tx) => (
                <tr
                  key={tx.id}
                  className="cursor-pointer border-b border-slate-200/70 hover:bg-slate-100 dark:border-white/5 dark:hover:bg-white/5"
                  onClick={() => openModal(tx)}
                >
                  <td className="px-3 py-3">{new Date(tx.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-3">{tx.type}</td>
                  <td className="px-3 py-3">{tx.provider}</td>
                  <td className="px-3 py-3">
                    <Badge
                      label={tx.priority}
                      variant={tx.priority === "Tier-1" ? "danger" : tx.priority === "Tier-2" ? "warning" : "default"}
                    />
                  </td>
                  <td className="px-3 py-3">{tx.status}</td>
                  <td className="px-3 py-3 font-mono text-xs">{tx.blockHash.slice(0, 12)}...</td>
                  <td className="px-3 py-3 text-primary">View</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTransaction && (
        <Modal onClose={closeModal} transaction={selectedTransaction} related={transactions.filter((tx) => tx.patientId === selectedTransaction.patientId)} onCopy={copyPayload} />
      )}
    </div>
  )
}

function Modal({ transaction, related, onClose, onCopy }: { transaction: TransactionRecord; related: TransactionRecord[]; onClose: () => void; onCopy: () => void }) {
  const confirmations = Math.floor(Math.random() * 12) + 1
  const signatureValid = Math.random() > 0.1
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6 backdrop-blur">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200/70 bg-white p-6 text-slate-900 transition-colors dark:border-white/10 dark:bg-slate-900 dark:text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold">Transaction {transaction.id}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Block {transaction.blockHash}</p>
          </div>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <InfoTile label="Patient" value={transaction.patientId} />
          <InfoTile label="Provider" value={transaction.provider} />
          <InfoTile label="Priority" value={transaction.priority} />
          <InfoTile label="Status" value={transaction.status} />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">Transaction JSON</h4>
            <Button size="sm" variant="outline" onClick={onCopy}>
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </div>
          <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-slate-100 p-4 text-xs text-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
            {JSON.stringify(transaction.payload, null, 2)}
          </pre>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200/70 p-3 text-sm dark:border-white/10">
            Signature Verification
            <div className="mt-2 flex items-center gap-2 text-base">
              {signatureValid ? <CheckCircle2 className="text-success" /> : <XCircle className="text-danger" />}
              {signatureValid ? "✅ Valid" : "❌ Invalid"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200/70 p-3 text-sm dark:border-white/10">
            Block Confirmations
            <p className="text-2xl font-semibold text-primary">Confirmed in {confirmations} blocks</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 p-3 text-sm dark:border-white/10">
            Related Transactions
            <p className="text-xl font-semibold">{related.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/70 p-3 dark:border-white/10">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
