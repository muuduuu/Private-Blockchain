import { promises as fs } from "fs";
import { MEMPOOL_CAPACITY, MEMPOOL_FILE, FILE_ENCODING } from "../../config/constants";
import { MempoolEntry, MempoolSnapshot, MempoolStats, PriorityBreakdownSnapshot, TransactionRecord } from "../../types";
import { PersistentStorage } from "../storage/PersistentStorage";

export interface MempoolOptions {
  logger?: typeof console;
}

const DEFAULT_STATS: MempoolStats = {
  tier1: { size: 0, capacity: MEMPOOL_CAPACITY.tier1 },
  tier2: { size: 0, capacity: MEMPOOL_CAPACITY.tier2 },
  tier3: { size: 0, capacity: MEMPOOL_CAPACITY.tier3 },
  validatorsOnline: 0,
  validatorsTotal: 0
};

export class Mempool {
  private snapshot: MempoolSnapshot = { tier1: [], tier2: [], tier3: [] };
  private logger: typeof console;

  constructor(options: MempoolOptions = {}) {
    this.logger = options.logger || console;
  }

  async initialize(): Promise<void> {
    await PersistentStorage.ensureDirectories();
    try {
      const raw = await fs.readFile(MEMPOOL_FILE, FILE_ENCODING);
      const parsed = JSON.parse(raw) as MempoolSnapshot;
      this.snapshot = parsed;
    } catch (error) {
      this.logger.warn("[Mempool] No existing mempool snapshot found, starting fresh");
      await this.persist();
    }
  }

  async addTransaction(tx: TransactionRecord, breakdown: PriorityBreakdownSnapshot): Promise<{ tier: 1 | 2 | 3; evicted?: MempoolEntry }> {
    const tier = this.determineTier(breakdown.priority, tx.tier);
    const entry: MempoolEntry = {
      id: tx.id,
      tx,
      tier,
      priority: breakdown.priority,
      breakdown,
      addedAt: new Date().toISOString()
    };

    const queue = this.getQueue(tier);
    queue.push(entry);
    queue.sort((a, b) => b.priority - a.priority);

    let evicted: MempoolEntry | undefined;
    const capacity = this.getCapacity(tier);
    if (queue.length > capacity) {
      evicted = queue.pop();
      if (evicted) {
        this.logger.warn(`[Mempool] Tier ${tier} queue full, evicted tx=${evicted.id}`);
      }
    }

    await this.persist();
    this.logger.info(`[Mempool] Added tx=${tx.id} to tier ${tier} (priority=${breakdown.priority.toFixed(3)})`);
    return { tier, evicted };
  }

  getTransactionsByTier(tier: 1 | 2 | 3, limit: number): TransactionRecord[] {
    const queue = this.getQueue(tier);
    return queue.slice(0, limit).map((entry) => entry.tx);
  }

  removeTransaction(txId: string): void {
    (['tier1', 'tier2', 'tier3'] as const).forEach((key) => {
      const queue = this.snapshot[key];
      const index = queue.findIndex((entry) => entry.id === txId);
      if (index >= 0) {
        queue.splice(index, 1);
        this.logger.info(`[Mempool] Removed tx=${txId} from ${key}`);
      }
    });
  }

  async flushTransactions(txIds: string[]): Promise<void> {
    txIds.forEach((id) => this.removeTransaction(id));
    await this.persist();
  }

  getQueueStats(validatorsOnline = 0, validatorsTotal = 0): MempoolStats {
    return {
      tier1: { size: this.snapshot.tier1.length, capacity: MEMPOOL_CAPACITY.tier1 },
      tier2: { size: this.snapshot.tier2.length, capacity: MEMPOOL_CAPACITY.tier2 },
      tier3: { size: this.snapshot.tier3.length, capacity: MEMPOOL_CAPACITY.tier3 },
      validatorsOnline,
      validatorsTotal
    };
  }

  getSnapshot(): MempoolSnapshot {
    return this.snapshot;
  }

  private determineTier(priorityScore: number, hintedTier?: number): 1 | 2 | 3 {
    if (hintedTier === 1 || priorityScore >= 0.85) {
      return 1;
    }
    if (hintedTier === 2 || priorityScore >= 0.6) {
      return 2;
    }
    return 3;
  }

  private getQueue(tier: 1 | 2 | 3) {
    if (tier === 1) return this.snapshot.tier1;
    if (tier === 2) return this.snapshot.tier2;
    return this.snapshot.tier3;
  }

  private getCapacity(tier: 1 | 2 | 3): number {
    if (tier === 1) return MEMPOOL_CAPACITY.tier1;
    if (tier === 2) return MEMPOOL_CAPACITY.tier2;
    return MEMPOOL_CAPACITY.tier3;
  }

  private async persist(): Promise<void> {
    await fs.writeFile(MEMPOOL_FILE, JSON.stringify(this.snapshot, null, 2), FILE_ENCODING);
  }
}
