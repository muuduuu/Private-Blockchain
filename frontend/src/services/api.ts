import axios from "axios"
import type {
	AuditLogEntry,
	DashboardMetrics,
	PriorityTier,
	ProviderOption,
	TransactionRecord,
	ValidatorNode,
} from "../types"

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"

export const http = axios.create({
	baseURL: API_BASE_URL,
	timeout: 12_000,
})

export interface TransactionFilters {
	patientId?: string
	type?: string
	priority?: PriorityTier
	status?: string
	limit?: number
}

interface CreateTransactionInput {
	patientId: string
	provider: string
	priority: PriorityTier
	data: Record<string, unknown>
	status?: TransactionRecord["status"]
}

const unwrap = async <T>(promise: Promise<{ data: { data: T } }>): Promise<T> => {
	const response = await promise
	return response.data.data
}

const mapTransaction = (record: TransactionRecord): TransactionRecord => ({
	...record,
	blockHash: record.blockHash ?? "pending",
})

const postTransaction = async (type: string, payload: CreateTransactionInput) => {
	const body = {
		type,
		patientId: payload.patientId,
		provider: payload.provider,
		priority: payload.priority,
		payload: payload.data,
		status: payload.status,
	}
	const { data } = await http.post("/transactions", body)
	return mapTransaction(data.data.transaction as TransactionRecord)
}

export const ApiService = {
	async fetchMetrics(): Promise<DashboardMetrics> {
		return unwrap(http.get("/metrics"))
	},

	async fetchValidators(): Promise<ValidatorNode[]> {
		return unwrap(http.get("/reference/validators"))
	},

	async fetchProviders(): Promise<ProviderOption[]> {
		return unwrap(http.get("/reference/providers"))
	},

	async fetchPatients(): Promise<string[]> {
		const patients = await unwrap(http.get("/reference/patients"))
		return patients.map((patient: { id: string }) => patient.id)
	},

	async fetchTransactions(filters: TransactionFilters = {}): Promise<TransactionRecord[]> {
		const { data } = await http.get("/transactions", { params: filters })
		return (data.data.transactions as TransactionRecord[]).map(mapTransaction)
	},

	async createEmergencyRecord(payload: CreateTransactionInput) {
		return postTransaction("Emergency Record", payload)
	},

	async createPrescription(payload: CreateTransactionInput) {
		return postTransaction("Pharmacy Order", payload)
	},

	async recordLabResult(payload: CreateTransactionInput) {
		return postTransaction("Lab Result", payload)
	},

	async searchTransactions(filters: TransactionFilters) {
		return this.fetchTransactions(filters)
	},

	async fetchAuditLog(): Promise<AuditLogEntry[]> {
		const { data } = await http.get("/audit", { params: { limit: 200 } })
		return data.data.entries as AuditLogEntry[]
	},
}

export const WalletApi = {
	requestChallenge: (address: string, type: "metamask" | "custom" = "metamask") =>
		http.post("/wallet/challenge", { address, type }).then((res) => res.data.data),
	verifySignature: (address: string, signature: string) =>
		http.post("/wallet/verify", { address, signature }).then((res) => res.data.data),
}
