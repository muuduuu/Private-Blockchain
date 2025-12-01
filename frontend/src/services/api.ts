import axios from "axios"
import type {
	AuditLogEntry,
	DashboardMetrics,
	PriorityTier,
	ProviderOption,
	TransactionRecord,
	ValidatorNode,
} from "../types"

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "https://mock.camtc.health"

export const http = axios.create({
	baseURL: API_BASE_URL,
	timeout: 10_000,
})

const providerDirectory: ProviderOption[] = [
	{ id: "prov-01", name: "Dr. Elena Martinez", specialty: "Emergency" },
	{ id: "prov-02", name: "Dr. Amir Hassan", specialty: "Cardiology" },
	{ id: "prov-03", name: "Dr. Priya Patel", specialty: "Neurology" },
	{ id: "prov-04", name: "Dr. Hannah Lewis", specialty: "Pharmacy" },
	{ id: "prov-05", name: "PA Marcus Li", specialty: "Emergency" },
	{ id: "prov-06", name: "NP Sophia Cruz", specialty: "Primary Care" },
	{ id: "prov-07", name: "Dr. Ethan Kim", specialty: "Radiology" },
	{ id: "prov-08", name: "Dr. Nia Abebe", specialty: "Critical Care" },
]

const samplePatients = Array.from({ length: 12 }, (_, idx) => `CAMTC-${1000 + idx}`)
const tiers: PriorityTier[] = ["Tier-1", "Tier-2", "Tier-3"]
const transactionLabels = [
	"Emergency Record",
	"Critical Lab",
	"Vital Signs",
	"Pharmacy Order",
	"Audit Update",
]

const randomHash = () => `0x${cryptoRandomString(64)}`
const randomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

function cryptoRandomString(length: number) {
	const chars = "abcdef0123456789"
	return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

const transactionLedger: TransactionRecord[] = Array.from({ length: 50 }, (_, index) => {
	const tier = tiers[index % tiers.length]
	const now = Date.now() - index * 45 * 60 * 1000
	return {
		id: `TX-${1400 + index}`,
		patientId: randomItem(samplePatients),
		type: transactionLabels[index % transactionLabels.length],
		provider: randomItem(providerDirectory).name,
		priority: tier,
		status: index % 7 === 0 ? "Pending" : index % 11 === 0 ? "Failed" : "Confirmed",
		blockHash: randomHash(),
		timestamp: new Date(now).toISOString(),
		payload: {
			tier,
			description: `Mock payload for ${tier}`,
		},
	}
})

const auditLedger: AuditLogEntry[] = Array.from({ length: 100 }, (_, index) => {
	const outcome = index % 13 === 0 ? "failed" : index % 17 === 0 ? "blocked" : "success"
	return {
		id: `AUD-${2000 + index}`,
		timestamp: new Date(Date.now() - index * 30 * 60 * 1000).toISOString(),
		action: ("Create,Read,Update,Delete".split(",") as AuditLogEntry["action"][])[index % 4],
		userId: `prov-${(index % providerDirectory.length) + 1}`,
		patientId: randomItem(samplePatients),
		ipAddress: `10.0.${index % 50}.${(index * 7) % 255}`,
		outcome,
		blockHash: randomHash(),
		details: `Simulated ${outcome} access for compliance record ${index}`,
	}
})

const validators: ValidatorNode[] = Array.from({ length: 10 }, (_, idx) => {
	const tier = idx < 5 ? "Tier-1" : idx < 8 ? "Tier-2" : "Tier-3"
	return {
		id: `VAL-${idx + 1}`,
		tier,
		reputation: Number((0.45 + Math.random() * 0.5).toFixed(2)),
		blocksProposed: 1200 + idx * 45 + Math.floor(Math.random() * 120),
		uptime: Number((92 + Math.random() * 7).toFixed(2)),
		lastSeen: new Date(Date.now() - idx * 5 * 60 * 1000).toISOString(),
	}
})

const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms))

const appendTransaction = (
	entry: Omit<TransactionRecord, "id" | "blockHash" | "timestamp" | "status"> & { status?: TransactionRecord["status"] },
) => {
	const record: TransactionRecord = {
		...entry,
		status: entry.status ?? "Pending",
		id: `TX-${Date.now()}`,
		blockHash: randomHash(),
		timestamp: new Date().toISOString(),
	}
	transactionLedger.unshift(record)
	auditLedger.unshift({
		id: `AUD-${Date.now()}`,
		timestamp: record.timestamp,
		action: "Create",
		userId: entry.provider,
		patientId: record.patientId,
		ipAddress: "10.0.0.1",
		outcome: "success",
		blockHash: record.blockHash,
		details: `Auto audit trail for ${record.type}`,
	})
	return record
}

export const ApiService = {
	async fetchMetrics(): Promise<DashboardMetrics> {
		await wait()
		const tpsTrend = Array.from({ length: 24 }, (_, idx) => ({
			timestamp: `${idx}:00`,
			value: Math.round(30 + Math.random() * 30),
		}))

		const distribution = tiers.map((tier, idx) => ({
			name: tier,
			value: transactionLedger.filter((tx) => tx.priority === tier).length,
			color: ["#EF4444", "#F59E0B", "#3B82F6"][idx],
		}))

		const validatorScores = validators.slice(0, 5).map((node) => ({
			name: node.id,
			value: Number((node.reputation * 100).toFixed(1)),
		}))

		const metrics: DashboardMetrics = {
			validatorsActive: validators.length,
			currentTps: Number((30 + Math.random() * 30).toFixed(2)),
			networkLatency: Number((80 + Math.random() * 40).toFixed(1)),
			totalBlocks: 120040 + transactionLedger.length,
			tpsTrend,
			transactionDistribution: distribution,
			validatorScores,
		}

		return metrics
	},

	async fetchValidators(): Promise<ValidatorNode[]> {
		await wait()
		return validators.map((node) => ({
			...node,
			reputation: Number((node.reputation + (Math.random() - 0.5) * 0.05).toFixed(2)),
		}))
	},

	async fetchProviders(): Promise<ProviderOption[]> {
		await wait(300)
		return providerDirectory
	},

	async fetchTransactions(): Promise<TransactionRecord[]> {
		await wait()
		return [...transactionLedger]
	},

	async createEmergencyRecord(payload: {
		patientId: string
		provider: string
		data: Record<string, unknown>
		priority: PriorityTier
	}) {
		await wait(600)
		return appendTransaction({
			patientId: payload.patientId,
			provider: payload.provider,
			priority: payload.priority,
			type: "Emergency Record",
			payload: payload.data,
			status: "Confirmed",
		})
	},

	async createPrescription(payload: {
		patientId: string
		provider: string
		priority: PriorityTier
		data: Record<string, unknown>
	}) {
		await wait(650)
		return appendTransaction({
			patientId: payload.patientId,
			provider: payload.provider,
			priority: payload.priority,
			type: "Pharmacy Order",
			payload: payload.data,
			status: "Confirmed",
		})
	},

	async recordLabResult(payload: {
		patientId: string
		provider: string
		priority: PriorityTier
		data: Record<string, unknown>
	}) {
		await wait(700)
		return appendTransaction({
			patientId: payload.patientId,
			provider: payload.provider,
			priority: payload.priority,
			type: "Lab Result",
			payload: payload.data,
			status: "Pending",
		})
	},

	async searchTransactions(filters: Partial<{ patientId: string; type: string; priority: PriorityTier }>) {
		await wait(400)
		return transactionLedger.filter((tx) => {
			if (filters.patientId && !tx.patientId.toLowerCase().includes(filters.patientId.toLowerCase())) return false
			if (filters.type && tx.type !== filters.type) return false
			if (filters.priority && tx.priority !== filters.priority) return false
			return true
		})
	},

	async fetchAuditLog(): Promise<AuditLogEntry[]> {
		await wait(500)
		return [...auditLedger]
	},
}

export const MockReferenceData = {
	providers: providerDirectory,
	patients: samplePatients,
}
