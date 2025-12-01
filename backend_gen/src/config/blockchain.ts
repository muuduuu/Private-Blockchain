import { randomUUID } from "crypto";
import { TransactionRecord } from "../types";

export interface GenesisConfig {
  chainId: string;
  version: string;
  timestamp: string;
  proposer: string;
  previousHash: string;
  transactions: TransactionRecord[];
  metadata: Record<string, unknown>;
}

export const GENESIS_TEMPLATE: GenesisConfig = {
  chainId: "camtc-health",
  version: "1.0.0",
  timestamp: new Date().toISOString(),
  proposer: "system",
  previousHash: "0x0",
  transactions: [],
  metadata: {
    description: "Genesis block for CAMTC Healthcare file-based ledger",
    deploymentId: randomUUID()
  }
};
