import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  AUDIT_DIR,
  AUDIT_EXPORT_DIR,
  AUDIT_LOG_FILE,
  AUDIT_LOG_MAX_BYTES,
  AUDIT_RETENTION_DAYS,
  FILE_ENCODING
} from "../../config/constants";
import {
  AuditLogEntry,
  AuditLogFilters,
  AuditLogQueryOptions,
  AuditLogQueryResult,
  AuditLogRecordInput
} from "../../types";
import { sha256 } from "../../utils/crypto";

const DAY_IN_MS = 86_400_000;

type Direction = "asc" | "desc";

export interface AuditLogServiceOptions {
  logger?: typeof console;
  cacheSize?: number;
}

export class AuditLogService {
  private logger: typeof console;
  private cache: AuditLogEntry[] = [];
  private cacheSize: number;
  private nextSequence = 1;
  private lastIntegrityHash = "AUDIT_ROOT";

  constructor(options: AuditLogServiceOptions = {}) {
    this.logger = options.logger ?? console;
    this.cacheSize = options.cacheSize ?? 256;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(AUDIT_DIR, { recursive: true });
    await fs.mkdir(AUDIT_EXPORT_DIR, { recursive: true });

    const exists = await this.exists(AUDIT_LOG_FILE);
    if (!exists) {
      await fs.writeFile(AUDIT_LOG_FILE, "", FILE_ENCODING);
      this.logger.info("[AuditLog] Created fresh ledger file");
      return;
    }

    await this.bootstrapStateFromFile();
    await this.enforceRetention();
    await this.rotateIfNeeded();
  }

  async record(input: AuditLogRecordInput): Promise<AuditLogEntry> {
    this.validateInput(input);

    const timestamp = input.timestamp ?? new Date().toISOString();
    const sequence = this.nextSequence++;
    const basePayload = {
      sequence,
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
      tags: input.tags ?? [],
      channel: input.channel ?? "system"
    } satisfies Omit<AuditLogEntry, "id" | "prevHash" | "integrityHash">;

    const entry: AuditLogEntry = {
      id: input.id ?? `aud-${sequence}-${randomUUID()}`,
      ...basePayload,
      prevHash: this.lastIntegrityHash,
      integrityHash: this.computeIntegrityHash(basePayload)
    };

    await fs.appendFile(AUDIT_LOG_FILE, JSON.stringify(entry) + "\n", FILE_ENCODING);
    this.lastIntegrityHash = entry.integrityHash;

    this.cache.unshift(entry);
    if (this.cache.length > this.cacheSize) {
      this.cache = this.cache.slice(0, this.cacheSize);
    }

    await this.rotateIfNeeded();
    if (AUDIT_RETENTION_DAYS > 0 && sequence % 50 === 0) {
      await this.enforceRetention();
    }
    return entry;
  }

  async query(options: AuditLogQueryOptions = {}): Promise<AuditLogQueryResult> {
    const entries = await this.readAllEntries();
    const filtered = this.applyFilters(entries, options.filters);
    const direction: Direction = options.direction ?? "desc";
    const ordered = this.sortEntries(filtered, direction);
    const limit = options.limit ?? 100;
    const startIndex = this.resolveCursorIndex(ordered, options.cursor);
    const window = ordered.slice(startIndex, startIndex + limit);

    const nextCursor = window.length === limit ? String(window[window.length - 1].sequence) : undefined;
    const previousCursor = startIndex > 0 && ordered[startIndex - 1] ? String(ordered[startIndex - 1].sequence) : undefined;

    return {
      entries: window,
      totalMatches: filtered.length,
      hasMore: Boolean(nextCursor),
      nextCursor,
      previousCursor
    };
  }

  async exportCsv(options: AuditLogQueryOptions = {}): Promise<string> {
    const { entries } = await this.query({ ...options, limit: options.limit ?? 1000 });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `audit-export-${timestamp}.csv`;
    const destination = path.join(AUDIT_EXPORT_DIR, filename);

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
      ].map((value) => this.escapeCsv(String(value))).join(",")
    );

    const csvPayload = [header.join(","), ...rows].join("\n");
    await fs.writeFile(destination, csvPayload, FILE_ENCODING);
    this.logger.info(`[AuditLog] Exported ${entries.length} entries -> ${filename}`);
    return destination;
  }

  private async bootstrapStateFromFile(): Promise<void> {
    try {
      const raw = await fs.readFile(AUDIT_LOG_FILE, FILE_ENCODING);
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) {
        return;
      }

      const entries = lines.map((line) => JSON.parse(line) as AuditLogEntry);
      entries.sort((a, b) => a.sequence - b.sequence);
      const last = entries[entries.length - 1];
      this.nextSequence = last.sequence + 1;
      this.lastIntegrityHash = last.integrityHash;
      this.cache = entries.slice(-this.cacheSize).reverse();
    } catch (error) {
      this.logger.error("[AuditLog] Failed to hydrate state, resetting ledger", error);
      await fs.writeFile(AUDIT_LOG_FILE, "", FILE_ENCODING);
      this.cache = [];
      this.nextSequence = 1;
      this.lastIntegrityHash = "AUDIT_ROOT";
    }
  }

  private async readAllEntries(): Promise<AuditLogEntry[]> {
    try {
      const raw = await fs.readFile(AUDIT_LOG_FILE, FILE_ENCODING);
      const lines = raw.split(/\r?\n/).filter(Boolean);
      return lines
        .map((line) => JSON.parse(line) as AuditLogEntry)
        .sort((a, b) => b.sequence - a.sequence);
    } catch (error) {
      this.logger.error("[AuditLog] Unable to read log file", error);
      return [];
    }
  }

  private applyFilters(entries: AuditLogEntry[], filters?: AuditLogFilters): AuditLogEntry[] {
    if (!filters) {
      return entries;
    }

    const fromTime = filters.from ? Date.parse(filters.from) : undefined;
    const toTime = filters.to ? Date.parse(filters.to) : undefined;
    const searchNeedle = filters.search?.toLowerCase();

    return entries.filter((entry) => {
      if (filters.actorId && entry.actorId !== filters.actorId) return false;
      if (filters.actorType && entry.actorType !== filters.actorType) return false;
      if (filters.patientId && entry.patientId !== filters.patientId) return false;
      if (filters.resource && entry.resource !== filters.resource) return false;
      if (filters.action && entry.action !== filters.action) return false;
      if (filters.outcome && entry.outcome !== filters.outcome) return false;

      if (fromTime && Date.parse(entry.timestamp) < fromTime) return false;
      if (toTime && Date.parse(entry.timestamp) > toTime) return false;

      if (filters.tags && filters.tags.length > 0) {
        const entryTags = entry.tags ?? [];
        const missingTag = filters.tags.some((tag) => !entryTags.includes(tag));
        if (missingTag) return false;
      }

      if (searchNeedle) {
        const haystack = [
          entry.details,
          entry.metadata ? JSON.stringify(entry.metadata) : "",
          entry.actorId,
          entry.resource,
          entry.blockHash,
          entry.patientId
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchNeedle)) {
          return false;
        }
      }

      return true;
    });
  }

  private sortEntries(entries: AuditLogEntry[], direction: Direction): AuditLogEntry[] {
    const sorted = [...entries].sort((a, b) => b.sequence - a.sequence);
    return direction === "asc" ? sorted.reverse() : sorted;
  }

  private resolveCursorIndex(entries: AuditLogEntry[], cursor?: string): number {
    if (!cursor) {
      return 0;
    }

    const sequence = Number(cursor);
    if (!Number.isFinite(sequence)) {
      return 0;
    }

    const index = entries.findIndex((entry) => entry.sequence === sequence);
    return index >= 0 ? index + 1 : 0;
  }

  private escapeCsv(value: string): string {
    if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private async enforceRetention(): Promise<void> {
    if (AUDIT_RETENTION_DAYS <= 0) {
      return;
    }

    const cutoff = Date.now() - AUDIT_RETENTION_DAYS * DAY_IN_MS;
    const entries = await this.readAllEntries();
    if (entries.length === 0) {
      return;
    }

    const retained = entries.filter((entry) => Date.parse(entry.timestamp) >= cutoff);
    if (retained.length === entries.length) {
      return;
    }

    retained.sort((a, b) => a.sequence - b.sequence);
    const lines = retained.map((entry) => JSON.stringify(entry));
    await fs.writeFile(AUDIT_LOG_FILE, lines.join("\n") + "\n", FILE_ENCODING);
    this.logger.warn(`[AuditLog] Pruned ${entries.length - retained.length} entries outside retention window`);
    await this.bootstrapStateFromFile();
  }

  private async rotateIfNeeded(): Promise<void> {
    if (AUDIT_LOG_MAX_BYTES <= 0) {
      return;
    }

    try {
      const stats = await fs.stat(AUDIT_LOG_FILE);
      if (stats.size < AUDIT_LOG_MAX_BYTES) {
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const rotated = path.join(AUDIT_DIR, `audit-log-${timestamp}.jsonl`);
      await fs.rename(AUDIT_LOG_FILE, rotated);
      await fs.writeFile(AUDIT_LOG_FILE, "", FILE_ENCODING);
      this.logger.warn(`[AuditLog] Rotated ledger -> ${path.basename(rotated)}`);
      await this.bootstrapStateFromFile();
    } catch (error) {
      this.logger.error("[AuditLog] Failed to rotate ledger", error);
    }
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

  private computeIntegrityHash(payload: Omit<AuditLogEntry, "id" | "prevHash" | "integrityHash">): string {
    return sha256(
      JSON.stringify({
        prevHash: this.lastIntegrityHash,
        ...payload
      })
    );
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
