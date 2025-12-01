export type PriorityTier = "Tier-1" | "Tier-2" | "Tier-3"
export type TransactionStatus = "Pending" | "Confirmed" | "Failed"

export interface MetricPoint {
  timestamp: string
  value: number
}

export interface DashboardMetrics {
  validatorsActive: number
  currentTps: number
  networkLatency: number
  totalBlocks: number
  tpsTrend: MetricPoint[]
  transactionDistribution: { name: string; value: number; color: string }[]
  validatorScores: { name: string; value: number }[]
}

export interface ValidatorNode {
  id: string
  tier: PriorityTier
  reputation: number
  blocksProposed: number
  uptime: number
  lastSeen: string
}

export interface TransactionRecord {
  id: string
  patientId: string
  type: string
  provider: string
  priority: PriorityTier
  status: TransactionStatus
  blockHash: string
  timestamp: string
  payload: Record<string, unknown>
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  action: "Create" | "Read" | "Update" | "Delete"
  userId: string
  patientId: string
  ipAddress: string
  outcome: "success" | "failed" | "blocked"
  blockHash: string
  details: string
}

export interface VitalSignsSnapshot {
  patientId: string
  heartRate: number
  bloodPressure: string
  temperature: number
  oxygen: number
  updatedAt: string
}

export interface SystemLogEntry {
  timestamp: string
  level: "info" | "warning" | "error"
  message: string
}

export interface ProviderOption {
  id: string
  name: string
  specialty: string
}

export interface WalletAuthResponse {
  nonce: string
  signature: string
}

export interface ApiResponse<T> {
  data: T
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export {}
