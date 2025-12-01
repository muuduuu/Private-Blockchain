import { DatabaseClient } from "../database/DatabaseClient";
import { tierToLabel, toTierNumber } from "../../utils/priority";

export interface TransactionFilterSet {
  patientId?: string;
  type?: string;
  priority?: string;
  status?: string;
}

export interface TransactionInsertInput {
  id: string;
  patientId: string;
  providerId?: string;
  type: string;
  tier: 1 | 2 | 3;
  priorityScore: number;
  payload: Record<string, unknown>;
  status?: string;
  signature?: string;
  blockHash?: string | null;
}

export interface TransactionListItem {
  id: string;
  patientId: string;
  type: string;
  provider: string;
  priority: string;
  status: string;
  blockHash: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export class TransactionRepository {
  constructor(private readonly database: DatabaseClient, private readonly logger: typeof console = console) {}

  async listTransactions(filters: TransactionFilterSet = {}, limit = 100): Promise<TransactionListItem[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.patientId) {
      conditions.push(`t.patient_id ILIKE $${idx++}`);
      params.push(`%${filters.patientId}%`);
    }

    if (filters.type) {
      conditions.push(`t.type = $${idx++}`);
      params.push(filters.type);
    }

    if (filters.priority) {
      conditions.push(`t.tier = $${idx++}`);
      params.push(toTierNumber(filters.priority));
    }

    if (filters.status) {
      conditions.push(`t.status = $${idx++}`);
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    const query = `
      SELECT t.id,
             t.patient_id,
             t.provider_id,
             t.type,
             t.tier,
             t.priority,
             t.payload,
             t.status,
             t.block_hash,
             t.created_at,
             p.name AS provider_name
        FROM transactions t
        LEFT JOIN providers p ON p.id = t.provider_id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${idx}
    `;

    const result = await this.database.query<{
      id: string;
      patient_id: string | null;
      provider_id: string | null;
      type: string;
      tier: number;
      priority: string;
      payload: Record<string, unknown> | null;
      status: string | null;
      block_hash: string | null;
      created_at: Date;
      provider_name: string | null;
    }>(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      patientId: row.patient_id ?? "UNKNOWN",
      type: row.type,
      provider: row.provider_name ?? row.provider_id ?? "Unknown",
      priority: tierToLabel(row.tier),
      status: row.status ?? "Pending",
      blockHash: row.block_hash ?? "pending",
      timestamp: row.created_at?.toISOString?.() ?? new Date().toISOString(),
      payload: this.parsePayload(row.payload)
    }));
  }

  async insertTransaction(input: TransactionInsertInput): Promise<void> {
    await this.database.query(
      `
      INSERT INTO transactions (id, patient_id, provider_id, type, tier, priority, payload, status, signature, block_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE
        SET patient_id = EXCLUDED.patient_id,
            provider_id = EXCLUDED.provider_id,
            type = EXCLUDED.type,
            tier = EXCLUDED.tier,
            priority = EXCLUDED.priority,
            payload = EXCLUDED.payload,
            status = EXCLUDED.status,
            signature = EXCLUDED.signature,
            block_hash = EXCLUDED.block_hash
    `,
      [
        input.id,
        input.patientId,
        input.providerId ?? null,
        input.type,
        input.tier,
        input.priorityScore,
        JSON.stringify(input.payload ?? {}),
        input.status ?? "Pending",
        input.signature ?? null,
        input.blockHash ?? null
      ]
    );

    this.logger.info(`[TransactionRepository] Upserted tx=${input.id}`);
  }

  private parsePayload(payload: Record<string, unknown> | string | null): Record<string, unknown> {
    if (!payload) {
      return {};
    }
    if (typeof payload === "string") {
      try {
        return JSON.parse(payload) as Record<string, unknown>;
      } catch (error) {
        this.logger.warn("[TransactionRepository] Failed to parse payload JSON", error);
        return {};
      }
    }
    return payload;
  }
}
