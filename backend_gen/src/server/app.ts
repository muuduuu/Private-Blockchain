import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { ChainState } from "../services/blockchain/ChainState";
import { Mempool } from "../services/blockchain/Mempool";
import { ContextEngine } from "../services/blockchain/ContextEngine";
import { AuditLogService } from "../services/compliance/AuditLogService";
import { WalletRegistry } from "../services/wallet/WalletRegistry";
import { WalletAuthService } from "../services/wallet/WalletAuthService";
import { ReferenceDirectory } from "../services/reference/ReferenceDirectory";
import { API_PREFIX } from "../config/constants";
import { MempoolEntry, MempoolSnapshot, TransactionRecord } from "../types";

class HttpError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

type TransactionFilters = {
  patientId?: string;
  type?: string;
  priority?: string;
  status?: string;
};

interface DashboardMetricsPayload {
  validatorsActive: number;
  currentTps: number;
  networkLatency: number;
  totalBlocks: number;
  tpsTrend: { timestamp: string; value: number }[];
  transactionDistribution: { name: string; value: number; color: string }[];
  validatorScores: { name: string; value: number }[];
}

const PRIORITY_LABELS: Record<1 | 2 | 3, string> = {
  1: "Tier-1",
  2: "Tier-2",
  3: "Tier-3"
};

export interface ServerDependencies {
  chainState: ChainState;
  mempool: Mempool;
  contextEngine: ContextEngine;
  auditLog: AuditLogService;
  walletRegistry: WalletRegistry;
  walletAuth: WalletAuthService;
  referenceDirectory: ReferenceDirectory;
}

export const buildServer = (deps: ServerDependencies) => {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    const chain = deps.chainState.getState();
    const mempoolStats = deps.mempool.getQueueStats();
    const walletCount = deps.walletRegistry.listWallets().length;
    const providers = deps.referenceDirectory.getProviders().length;
    const patients = deps.referenceDirectory.getPatients().length;

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      chain,
      mempool: mempoolStats,
      wallets: { total: walletCount },
      directory: { providers, patients },
      version: "0.1.0"
    });
  });

  const api = express.Router();

  api.get("/metrics", (_req, res) => {
    const stats = deps.mempool.getQueueStats();
    const validators = deps.referenceDirectory.getValidators();
    const chain = deps.chainState.getState();
    const metrics = buildMetricsPayload(stats, validators, chain?.blocks ?? 0);
    res.json({ data: metrics });
  });

  api.get("/reference/providers", (_req, res) => {
    res.json({ data: deps.referenceDirectory.getProviders() });
  });

  api.get("/reference/patients", (_req, res) => {
    res.json({ data: deps.referenceDirectory.getPatients() });
  });

  api.get("/reference/validators", (_req, res) => {
    res.json({ data: deps.referenceDirectory.getValidators() });
  });

  api.get("/transactions", (req, res) => {
    const filters = {
      patientId: getQueryString(req.query.patientId),
      type: getQueryString(req.query.type),
      priority: getQueryString(req.query.priority),
      status: getQueryString(req.query.status)
    };
    const limit = parseLimit(req.query.limit, 100);
    respondWithTransactions(deps, res, filters, limit);
  });

  api.post("/transactions", async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      validateTransactionPayload(payload);

      const resolvedTier = toTierNumber(payload.priority ?? payload.tier);

      const baseRecord: TransactionRecord = {
        id: payload.id ?? `tx-${randomUUID()}`,
        type: payload.type,
        tier: resolvedTier,
        priority: 0,
        payload: {
          ...(payload.payload ?? {}),
          patientId: payload.patientId,
          provider: payload.provider,
          providerId: payload.providerId ?? payload.provider,
          priorityLabel: payload.priority,
          status: payload.status ?? "Pending"
        },
        signature: payload.signature ?? "pending",
        createdAt: new Date().toISOString()
      };

      const breakdown = await deps.contextEngine.calculatePriority(baseRecord);
      baseRecord.priority = breakdown.priority;

      const { tier, evicted } = await deps.mempool.addTransaction(baseRecord, breakdown);
      baseRecord.tier = tier;

      await deps.auditLog.record({
        action: "Transaction.Submit",
        actorId: payload.actorId ?? req.ip ?? "anonymous",
        actorType: payload.actorType ?? "api",
        resource: `transaction:${baseRecord.id}`,
        outcome: "success",
        details: payload.details ?? payload.type,
        metadata: {
          tier,
          priority: breakdown.priority,
          source: "rest-api"
        }
      });

      const mapped = mapEntryToUi({
        id: baseRecord.id,
        tx: baseRecord,
        tier,
        priority: breakdown.priority,
        breakdown,
        addedAt: new Date().toISOString()
      });

      res.status(201).json({
        data: {
          transaction: mapped,
          breakdown,
          tier,
          evicted: evicted ? mapEntryToUi(evicted) : null
        },
        stats: deps.mempool.getQueueStats()
      });
    } catch (error) {
      next(error);
    }
  });

  api.get("/audit", async (req, res, next) => {
    try {
      const filters = buildAuditFilters(req.query);
      const limit = parseLimit(req.query.limit, 100);
      const direction = req.query.direction === "asc" ? "asc" : "desc";
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

      const result = await deps.auditLog.query({ filters, limit, direction, cursor });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  api.post("/wallet/challenge", async (req, res, next) => {
    try {
      const { address, type, label, metadata, customPublicKey } = req.body ?? {};
      if (!address) {
        throw new HttpError(400, "address is required");
      }

      const challenge = await deps.walletAuth.issueNonce(address, {
        walletType: type,
        label,
        metadata,
        customPublicKey
      });

      await deps.auditLog.record({
        action: "Wallet.Challenge",
        actorId: challenge.wallet.address,
        actorType: challenge.wallet.type,
        resource: "wallet.challenge",
        outcome: "success",
        details: `Nonce issued (expires ${challenge.expiresAt})`,
        metadata: { expiresAt: challenge.expiresAt }
      });

      res.json({ data: challenge });
    } catch (error) {
      next(error);
    }
  });

  api.post("/wallet/verify", async (req, res, next) => {
    try {
      const { address, signature } = req.body ?? {};
      if (!address || !signature) {
        throw new HttpError(400, "address and signature are required");
      }

      const result = await deps.walletAuth.verifySignature(address, signature);

      await deps.auditLog.record({
        action: "Wallet.Verify",
        actorId: result.wallet.address,
        actorType: result.wallet.type,
        resource: "wallet.verify",
        outcome: "success",
        details: "Wallet signature verified",
        metadata: { proof: result.proof }
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  app.use(API_PREFIX, api);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
      return;
    }

    console.error("[Server] Unexpected error", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    res.status(500).json({ error: { message } });
  });

  return app;
};

const respondWithTransactions = (
  deps: ServerDependencies,
  res: Response,
  filters: TransactionFilters,
  limit: number
) => {
  const snapshot: MempoolSnapshot = deps.mempool.getSnapshot();
  const stats = deps.mempool.getQueueStats();
  const allEntries = [...snapshot.tier1, ...snapshot.tier2, ...snapshot.tier3];
  const mapped = allEntries.map(mapEntryToUi);
  const filtered = mapped.filter((tx) => matchesTransactionFilters(tx, filters)).slice(0, limit);

  res.json({
    data: {
      transactions: filtered,
      snapshot,
      stats
    }
  });
};

const parseLimit = (value: unknown, fallback: number): number => {
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : fallback;
};

const matchesTransactionFilters = (
  tx: ReturnType<typeof mapEntryToUi>,
  filters: TransactionFilters
): boolean => {
  if (filters.patientId && !tx.patientId.toLowerCase().includes(filters.patientId.toLowerCase())) {
    return false;
  }
  if (filters.type && tx.type !== filters.type) {
    return false;
  }
  if (filters.priority && tx.priority !== filters.priority) {
    return false;
  }
  if (filters.status && tx.status !== filters.status) {
    return false;
  }
  return true;
};

const buildAuditFilters = (query: Request["query"]) => {
  const filters = {
    actorId: getQueryString(query.actorId),
    actorType: getQueryString(query.actorType),
    patientId: getQueryString(query.patientId),
    resource: getQueryString(query.resource),
    action: getQueryString(query.action),
    outcome: getQueryString(query.outcome),
    from: getQueryString(query.from),
    to: getQueryString(query.to),
    search: getQueryString(query.search)
  };

  const tagsRaw = query.tags;
  if (typeof tagsRaw === "string") {
    return { ...filters, tags: tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean) };
  }
  return filters;
};

const getQueryString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const validateTransactionPayload = (payload: Record<string, unknown>): void => {
  if (!payload.type || typeof payload.type !== "string") {
    throw new HttpError(400, "Transaction type is required");
  }

  if (!payload.patientId || typeof payload.patientId !== "string") {
    throw new HttpError(400, "patientId is required");
  }

  if (!payload.provider || typeof payload.provider !== "string") {
    throw new HttpError(400, "provider is required");
  }

  if (!payload.priority || typeof payload.priority !== "string") {
    throw new HttpError(400, "priority label is required (Tier-1/Tier-2/Tier-3)");
  }

  if (payload.payload && typeof payload.payload !== "object") {
    throw new HttpError(400, "payload must be an object");
  }
};

const mapEntryToUi = (entry: MempoolEntry) => {
  const payload = (entry.tx.payload ?? {}) as Record<string, unknown>;
  const patientId = typeof payload.patientId === "string" ? payload.patientId : "UNKNOWN";
  const provider = typeof payload.provider === "string" ? payload.provider : "Unknown";
  const status = typeof payload.status === "string" ? payload.status : "Pending";
  const blockHash = typeof payload.blockHash === "string" ? payload.blockHash : "pending";
  const priority = typeof payload.priorityLabel === "string" ? payload.priorityLabel : PRIORITY_LABELS[entry.tier];

  return {
    id: entry.tx.id,
    patientId,
    type: entry.tx.type,
    provider,
    priority,
    status,
    blockHash,
    timestamp: entry.tx.createdAt,
    payload
  };
};

const toTierNumber = (value: unknown): 1 | 2 | 3 => {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }

  if (typeof value === "number") {
    if (value <= 1) return 1;
    if (value === 2) return 2;
    return 3;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized.includes("tier-1") || normalized.includes("critical")) {
      return 1;
    }
    if (normalized.includes("tier-2") || normalized.includes("priority")) {
      return 2;
    }
    if (normalized.includes("tier-3")) {
      return 3;
    }
  }

  return 3;
};

const buildMetricsPayload = (
  stats: ReturnType<Mempool["getQueueStats"]>,
  validators: ReturnType<ReferenceDirectory["getValidators"]>,
  totalBlocks: number
): DashboardMetricsPayload => {
  const pending = stats.tier1.size + stats.tier2.size + stats.tier3.size;
  const uptime = Math.max(process.uptime(), 1);
  const currentTps = Number(((pending / uptime) * 60).toFixed(2));
  const networkLatency = Number((60 + stats.tier1.size * 1.5 + stats.tier2.size * 0.6 + stats.tier3.size * 0.2).toFixed(1));

  const tpsTrend = Array.from({ length: 24 }, (_, idx) => ({
    timestamp: `${idx}:00`,
    value: Number((currentTps + Math.sin(idx / 3) * 5).toFixed(1))
  }));

  const colors = ["#EF4444", "#F59E0B", "#3B82F6"];
  const transactionDistribution = [
    { name: "Tier-1", value: stats.tier1.size, color: colors[0] },
    { name: "Tier-2", value: stats.tier2.size, color: colors[1] },
    { name: "Tier-3", value: stats.tier3.size, color: colors[2] }
  ];

  const validatorScores = validators.slice(0, 5).map((node) => ({
    name: node.id,
    value: Number((node.reputation * 100).toFixed(1))
  }));

  return {
    validatorsActive: validators.length,
    currentTps,
    networkLatency,
    totalBlocks,
    tpsTrend,
    transactionDistribution,
    validatorScores
  };
};
