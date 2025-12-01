import { create } from "zustand"
import { ApiService } from "../services/api"
import type { AuditLogEntry, TransactionRecord } from "../types"

interface TransactionStoreState {
  transactions: TransactionRecord[]
  auditLog: AuditLogEntry[]
  loading: boolean
  selectedTransaction?: TransactionRecord
  fetchTransactions: () => Promise<void>
  fetchAuditLog: () => Promise<void>
  addTransaction: (record: TransactionRecord) => void
  setSelectedTransaction: (tx?: TransactionRecord) => void
}

export const useTransactionStore = create<TransactionStoreState>((set, get) => ({
  transactions: [],
  auditLog: [],
  loading: false,
  selectedTransaction: undefined,
  fetchTransactions: async () => {
    set({ loading: true })
    try {
      const data = await ApiService.fetchTransactions()
      set({ transactions: data })
    } finally {
      set({ loading: false })
    }
  },
  fetchAuditLog: async () => {
    const data = await ApiService.fetchAuditLog()
    set({ auditLog: data })
  },
  addTransaction: (record) => {
    const { transactions } = get()
    set({ transactions: [record, ...transactions].slice(0, 200) })
  },
  setSelectedTransaction: (selectedTransaction) => set({ selectedTransaction }),
}))
