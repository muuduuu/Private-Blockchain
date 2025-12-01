import { createHash } from "crypto";
import { ValidatorProfile } from "../../types";

export interface VRFResult {
  validator: ValidatorProfile;
  hash: number; // normalized 0-1 value
  proof: string;
  seed: string;
}

const BASE_THRESHOLD = 0.65;

const normalizeHash = (hex: string): number => {
  const max = BigInt("0x" + "f".repeat(64));
  const value = BigInt("0x" + hex);
  return Number(value) / Number(max);
};

const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");

export class VRFService {
  private validators: ValidatorProfile[];

  constructor(validators: ValidatorProfile[]) {
    this.validators = validators;
  }

  setValidators(validators: ValidatorProfile[]): void {
    this.validators = validators;
  }

  async selectProposer(blockHeight: number, overrideSeed?: string): Promise<VRFResult | null> {
    const activeValidators = this.validators.filter((v) => v.isActive && v.stake > 0);
    if (activeValidators.length === 0) {
      return null;
    }

    const seed = overrideSeed || sha256Hex(`${blockHeight}:${Date.now()}`);
    const eligibility: VRFResult[] = [];

    for (const validator of activeValidators) {
      const output = await this.computeVRF(validator, seed);
      const threshold = this.computeThreshold(validator);

      if (output.hash < threshold) {
        eligibility.push({ validator, ...output, seed });
      }
    }

    if (eligibility.length === 0) {
      // Fallback: select highest reputation validator to maintain liveness
      const sorted = [...activeValidators].sort((a, b) => b.reputation - a.reputation);
      const fallback = await this.computeVRF(sorted[0], seed);
      return { validator: sorted[0], ...fallback, seed };
    }

    eligibility.sort((a, b) => b.hash - a.hash);
    return eligibility[0];
  }

  async computeVRF(validator: ValidatorProfile, seed: string): Promise<Omit<VRFResult, "validator" | "seed">> {
    const material = `${validator.privateKey}:${seed}`;
    const hashHex = sha256Hex(material);
    const proof = sha256Hex(hashHex + validator.publicKey + seed);
    const hash = normalizeHash(hashHex);
    return { hash, proof };
  }

  private computeThreshold(validator: ValidatorProfile): number {
    const stakeNormalized = Math.sqrt(validator.stake || 1) / 1000;
    const reputationSquared = Math.pow(Math.max(validator.reputation, 0), 2);
    const threshold = BASE_THRESHOLD * stakeNormalized * reputationSquared;
    return Math.min(1, Math.max(0.05, threshold));
  }
}
