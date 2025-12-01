import { createHash } from "crypto";
import { BlockRecord, TransactionRecord } from "../types";

export const sha256 = (value: string): string => {
  return createHash("sha256").update(value).digest("hex");
};

export const calculateMerkleRoot = (transactions: TransactionRecord[]): string => {
  if (transactions.length === 0) {
    return sha256("GENESIS_MERKLE_ROOT");
  }

  let layer = transactions.map((tx) => sha256(JSON.stringify(tx)));

  while (layer.length > 1) {
    const nextLayer: string[] = [];

    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] || left;
      nextLayer.push(sha256(left + right));
    }

    layer = nextLayer;
  }

  return layer[0];
};

export const calculateBlockHash = (block: Omit<BlockRecord, "hash">): string => {
  const header = {
    height: block.height,
    timestamp: block.timestamp,
    proposer: block.proposer,
    previousHash: block.previousHash,
    merkleRoot: block.merkleRoot,
    status: block.status
  };

  return sha256(JSON.stringify(header));
};
