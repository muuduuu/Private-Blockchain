import { create } from "zustand"
import { ApiService } from "../services/api"
import type {
  DashboardMetrics,
  SystemLogEntry,
  ValidatorNode,
} from "../types"

interface MetricsState {
  metrics?: DashboardMetrics
  validators: ValidatorNode[]
  systemLogs: SystemLogEntry[]
  loading: boolean
  fetchMetrics: () => Promise<void>
  refreshValidators: () => Promise<void>
  pushSystemLog: (entry: SystemLogEntry) => void
  updateTps: (tps: number) => void
}

export const useMetricsStore = create<MetricsState>((set, get) => ({
  metrics: undefined,
  validators: [],
  systemLogs: [],
  loading: false,
  fetchMetrics: async () => {
    set({ loading: true })
    try {
      const metrics = await ApiService.fetchMetrics()
      set({ metrics })
    } finally {
      set({ loading: false })
    }
  },
  refreshValidators: async () => {
    const validators = await ApiService.fetchValidators()
    set({ validators })
  },
  pushSystemLog: (entry) => {
    const logs = get().systemLogs
    set({ systemLogs: [entry, ...logs].slice(0, 200) })
  },
  updateTps: (tps) => {
    const metrics = get().metrics
    if (!metrics) return
    set({ metrics: { ...metrics, currentTps: Number(tps.toFixed(2)) } })
  },
}))
