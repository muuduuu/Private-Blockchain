import { randomUUID } from "crypto";
import { AuditLogEntry, AuditLogFilters, AuditLogQueryOptions, AuditLogQueryResult, AuditLogRecordInput } from "../../types";
import { DatabaseClient } from "../database/DatabaseClient";
import { sha256 } from "../../utils/crypto";

export interface AuditLogServiceOptions {
  logger?: typeof console;
}

type Direction = "asc" | "desc";

type AuditLogRow = {
  sequence: number;
  entry_id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  resource: string;
  outcome: string;
  patient_id: string | null;
  ip_address: string | null;
  block_hash: string | null;
  prev_hash: string | null;
  integrity_hash: string;
  tags: string[] | null;
  metadata: Record<string, unknown> | string | null;
  created_at: Date;
  channel: string | null;
  details?: string | null;
  total_count?: number;
};

export class AuditLogService {
  private lastIntegrityHash = "AUDIT_ROOT";
  private readonly logger: typeof console;

  constructor(private readonly database: DatabaseClient, options: AuditLogServiceOptions = {}) {
    this.logger = options.logger ?? console;
  }

  async initialize(): Promise<void> {
    await this.hydrateState();
  }

  async record(input: AuditLogRecordInput): Promise<AuditLogEntry> {
    this.validateInput(input);

    const timestamp = input.timestamp ?? new Date().toISOString();
    const channel = input.channel ?? "system";
    const basePayload = {
      timestamp,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType,
      resource: input.resource,
      outcome: input.outcome,
      patientId: input.patientId,
      ipAddress: input.ipAddress,
      blockHash: input.blockHash,
      details: input.details,
      metadata: input.metadata,
      tags: input.tags ?? []
    } satisfies Omit<AuditLogEntry, "id" | "sequence" | "prevHash" | "integrityHash" | "channel">;

    const entryId = input.id ?? `aud-${randomUUID()}`;
    const prevHash = this.lastIntegrityHash;
    const integrityHash = this.computeIntegrityHash(basePayload, prevHash);

    const result = await this.database.query<{ sequence: number; created_at: Date }>(
      `INSERT INTO audit_log (
        entry_id,
        actor_id,
        actor_type,
        action,
        resource,
        outcome,
        patient_id,
        ip_address,
        block_hash,
        prev_hash,
        integrity_hash,
        tags,
        metadata,
        created_at,
        channel
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13::jsonb,
        $14,
        $15
      ) RETURNING sequence, created_at`,
      [
        entryId,
        basePayload.actorId,
        basePayload.actorType,
        basePayload.action,
        basePayload.resource,
        basePayload.outcome,
        basePayload.patientId ?? null,
        basePayload.ipAddress ?? null,
        basePayload.blockHash ?? null,
        prevHash,
        integrityHash,
        basePayload.tags,
        JSON.stringify(basePayload.metadata ?? {}),
        timestamp,
        channel
      ]
    );

    const persisted = result.rows[0];

    const persistedTimestamp = persisted.created_at?.toISOString?.() ?? timestamp;

    const entry: AuditLogEntry = {
      id: entryId,
      sequence: persisted.sequence,
      ...basePayload,
      timestamp: persistedTimestamp,
      channel,
      prevHash,
      integrityHash
    };

    this.lastIntegrityHash = integrityHash;
    this.logger.info(`[AuditLog] Recorded entry ${entry.id}`);
    return entry;
  }

  async query(options: AuditLogQueryOptions = {}): Promise<AuditLogQueryResult> {
    const direction: Direction = options.direction ?? "desc";
    const limit = Math.min(options.limit ?? 100, 1000);

    const clauseState = this.buildWhereClause(options.filters);
    const params = clauseState.params;
    let nextIndex = clauseState.nextIndex;
    const cursorPredicate = this.buildCursorPredicate(options.cursor, direction, params, () => nextIndex++);
    const clauses = [clauseState.predicate, cursorPredicate].filter(Boolean);
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    params.push(limit + 1);
    const limitPlaceholder = `$${nextIndex}`;
    const query = `
      SELECT sequence,
             entry_id,
             actor_id,
             actor_type,
             action,
             resource,
             outcome,
             patient_id,
             ip_address,
             block_hash,
             prev_hash,
             integrity_hash,
             tags,
             metadata,
             created_at,
             channel,
             details,
             COUNT(*) OVER () AS total_count
        FROM audit_log
        ${whereClause}
        ORDER BY sequence ${direction === "desc" ? "DESC" : "ASC"}
        LIMIT ${limitPlaceholder}
    `;

    const result = await this.database.query<AuditLogRow>(query, params);
    const rows = result.rows;
    const hasMore = rows.length > limit;
    const window = rows.slice(0, limit);
    const entries = window.map((row) => this.mapRow(row));
    const totalMatches = rows[0]?.total_count ?? entries.length;

    const nextCursor = hasMore && entries.length > 0 ? String(entries[entries.length - 1].sequence) : undefined;
    const previousCursor = entries.length > 0 ? String(entries[0].sequence) : undefined;

    return {
      entries,
      totalMatches,
      nextCursor,
      previousCursor,
      hasMore
    };
  }

  async exportCsv(options: AuditLogQueryOptions = {}): Promise<string> {
    const { entries } = await this.query({ ...options, limit: options.limit ?? 1000 });
    const header = [
      "sequence",
      "id",
      "timestamp",
      "action",
      "actorId",
      "actorType",
      "resource",
      "outcome",
      "patientId",
      "ipAddress",
      "blockHash",
      "channel",
      "tags",
      "details"
    ];

    const rows = entries.map((entry) =>
      [
        entry.sequence,
        entry.id,
        entry.timestamp,
        entry.action,
        entry.actorId,
        entry.actorType,
        entry.resource,
        entry.outcome,
        entry.patientId ?? "",
        entry.ipAddress ?? "",
        entry.blockHash ?? "",
        entry.channel ?? "",
        (entry.tags ?? []).join("|"),
        entry.details ?? ""
      ]
        .map((value) => this.escapeCsv(String(value)))
        .join(",")
    );

    return [header.join(","), ...rows].join("\n");
  }

  private async hydrateState(): Promise<void> {
    const result = await this.database.query<{ integrity_hash: string }>(
      "SELECT integrity_hash FROM audit_log ORDER BY sequence DESC LIMIT 1"
    );
    if (result.rows[0]?.integrity_hash) {
      this.lastIntegrityHash = result.rows[0].integrity_hash;
    }
  }

  private buildWhereClause(filters?: AuditLogFilters) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const push = (predicate: string, value: unknown) => {
      clauses.push(predicate.replace("$idx", `$${idx}`));
      params.push(value);
      idx += 1;
    };

    if (filters) {
      if (filters.actorId) push("actor_id = $idx", filters.actorId);
      if (filters.actorType) push("actor_type = $idx", filters.actorType);
      if (filters.patientId) push("patient_id = $idx", filters.patientId);
      if (filters.resource) push("resource = $idx", filters.resource);
      if (filters.action) push("action = $idx", filters.action);
      if (filters.outcome) push("outcome = $idx", filters.outcome);
      if (filters.from) push("created_at >= $idx", filters.from);
      if (filters.to) push("created_at <= $idx", filters.to);
      if (filters.search) {
        push("(resource ILIKE $idx OR actor_id ILIKE $idx OR details ILIKE $idx OR metadata::text ILIKE $idx)", `%${filters.search}%`);
      }
      if (filters.tags && filters.tags.length > 0) {
        push("tags @> $idx", filters.tags);
      }
    }

    return {
      predicate: clauses.length > 0 ? clauses.join(" AND ") : "",
      params,
      nextIndex: idx
    };
  }

  private buildCursorPredicate(
    cursor: string | undefined,
    direction: Direction,
    params: unknown[],
    allocateIndex: () => number
  ): string {
    if (!cursor) {
      return "";
    }
    const sequence = Number(cursor);
    if (!Number.isFinite(sequence)) {
      return "";
    }
    const comparator = direction === "desc" ? "<" : ">";
    const placeholderIndex = allocateIndex();
    params.push(sequence);
    return `sequence ${comparator} $${placeholderIndex}`;
  }

  private mapRow(row: AuditLogRow): AuditLogEntry {
    return {
      id: row.entry_id,
      sequence: row.sequence,
      timestamp: row.created_at?.toISOString?.() ?? new Date().toISOString(),
      action: row.action,
      actorId: row.actor_id,
      actorType: row.actor_type,
      resource: row.resource,
      outcome: row.outcome,
      patientId: row.patient_id ?? undefined,
      ipAddress: row.ip_address ?? undefined,
      blockHash: row.block_hash ?? undefined,
      details: row.details ?? undefined,
      metadata: this.parseJson(row.metadata),
      tags: row.tags ?? [],
      channel: row.channel ?? undefined,
      prevHash: row.prev_hash ?? "AUDIT_ROOT",
      integrityHash: row.integrity_hash
    };
  }

  private parseJson(payload: Record<string, unknown> | string | null): Record<string, unknown> | undefined {
    if (!payload) {
      return undefined;
    }
    if (typeof payload === "string") {
      try {
        return JSON.parse(payload) as Record<string, unknown>;
      } catch (error) {
        this.logger.warn("[AuditLog] Failed to parse metadata JSON", error);
        return undefined;
      }
    }
    return payload;
  }

  private escapeCsv(value: string): string {
    if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private computeIntegrityHash(
    payload: Omit<AuditLogEntry, "id" | "sequence" | "prevHash" | "integrityHash" | "channel">,
    prevHash: string
  ): string {
    return sha256(
      JSON.stringify({
        prevHash,
        ...payload
      })
    );
  }

  private validateInput(input: AuditLogRecordInput): void {
    if (!input.action) {
      throw new Error("AuditLogService.record missing required field: action");
    }
    if (!input.actorId) {
      throw new Error("AuditLogService.record missing required field: actorId");
    }
    if (!input.actorType) {
      throw new Error("AuditLogService.record missing required field: actorType");
    }
    if (!input.resource) {
      throw new Error("AuditLogService.record missing required field: resource");
    }
    if (!input.outcome) {
      throw new Error("AuditLogService.record missing required field: outcome");
    }
  }
}
