import { TransactionRecord, MempoolStats, PriorityBreakdownSnapshot } from "../../types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const CRITICALITY_KEYWORDS: { pattern: RegExp; score: number }[] = [
  { pattern: /cardiac arrest/i, score: 0.95 },
  { pattern: /stroke/i, score: 0.93 },
  { pattern: /sepsis|trauma/i, score: 0.9 },
  { pattern: /prescription/i, score: 0.65 },
  { pattern: /lab|diagnostic/i, score: 0.5 },
  { pattern: /routine|checkup/i, score: 0.35 }
];

const SENSITIVITY_FLAGS: { pattern: RegExp; score: number }[] = [
  { pattern: /stat/i, score: 0.95 },
  { pattern: /urgent/i, score: 0.8 },
  { pattern: /routine/i, score: 0.4 }
];

const COMPLIANCE_FLAGS: { pattern: RegExp; score: number }[] = [
  { pattern: /controlled substance/i, score: 0.5 },
  { pattern: /prescription/i, score: 0.3 }
];

export interface ContextEngineOptions {
  statsProvider?: () => Promise<MempoolStats | null> | MempoolStats | null;
  logger?: typeof console;
}

export class ContextEngine {
  private statsProvider?: () => Promise<MempoolStats | null> | MempoolStats | null;
  private logger: typeof console;

  constructor(options: ContextEngineOptions = {}) {
    this.statsProvider = options.statsProvider;
    this.logger = options.logger || console;
  }

  async calculatePriority(tx: TransactionRecord): Promise<PriorityBreakdownSnapshot> {
    const payloadText = this.extractPayloadText(tx);
    const criticality = this.calculateCriticality(tx.type, payloadText);
    const sensitivity = this.calculateSensitivity(payloadText);
    const resources = await this.calculateResources();
    const compliance = this.calculateCompliance(payloadText);

    const priority = clamp01(
      0.45 * criticality +
        0.35 * sensitivity +
        0.1 * resources +
        0.1 * compliance
    );

    const breakdown: PriorityBreakdownSnapshot = {
      criticality,
      sensitivity,
      resources,
      compliance,
      priority
    };

    this.logger.info(
      `[ContextEngine] Priority calculated for tx=${tx.id}: priority=${priority.toFixed(3)} ` +
        `(C=${criticality.toFixed(2)}, S=${sensitivity.toFixed(2)}, R=${resources.toFixed(2)}, K=${compliance.toFixed(2)})`
    );

    return breakdown;
  }

  private extractPayloadText(tx: TransactionRecord): string {
    const segments: string[] = [tx.type];

    const traverse = (value: unknown): void => {
      if (!value) return;
      if (typeof value === "string") {
        segments.push(value);
      } else if (typeof value === "number" || typeof value === "boolean") {
        segments.push(String(value));
      } else if (Array.isArray(value)) {
        value.forEach(traverse);
      } else if (typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach(traverse);
      }
    };

    traverse(tx.payload);
    return segments.join(" ");
  }

  private calculateCriticality(type: string, payloadText: string): number {
    const text = `${type} ${payloadText}`;
    for (const keyword of CRITICALITY_KEYWORDS) {
      if (keyword.pattern.test(text)) {
        return keyword.score;
      }
    }
    return 0.4;
  }

  private calculateSensitivity(payloadText: string): number {
    for (const flag of SENSITIVITY_FLAGS) {
      if (flag.pattern.test(payloadText)) {
        return flag.score;
      }
    }
    return 0.5;
  }

  private async calculateResources(): Promise<number> {
    const stats = await this.resolveStats();
    if (!stats) {
      return 0.5;
    }

    const totalSize = stats.tier1.size + stats.tier2.size + stats.tier3.size;
    const totalCapacity = stats.tier1.capacity + stats.tier2.capacity + stats.tier3.capacity;
    const utilization = totalCapacity > 0 ? totalSize / totalCapacity : 0;

    const validatorAvailability = stats.validatorsTotal > 0
      ? stats.validatorsOnline / stats.validatorsTotal
      : 1;

    // Higher utilization should lower the resource score, while higher availability raises it.
    const resourceScore = clamp01(0.2 + 0.6 * validatorAvailability - 0.5 * utilization);
    return resourceScore;
  }

  private calculateCompliance(payloadText: string): number {
    for (const flag of COMPLIANCE_FLAGS) {
      if (flag.pattern.test(payloadText)) {
        return flag.score;
      }
    }
    return 0.1;
  }

  private async resolveStats(): Promise<MempoolStats | null> {
    if (!this.statsProvider) {
      return null;
    }

    const provider = this.statsProvider;
    if (typeof provider === "function") {
      const result = provider();
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    }

    return provider;
  }
}
