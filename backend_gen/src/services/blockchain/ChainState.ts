import { GENESIS_TEMPLATE } from "../../config/blockchain";
import { BLOCKS_DIR } from "../../config/constants";
import { BlockRecord, ChainStateRecord } from "../../types";
import { calculateBlockHash, calculateMerkleRoot } from "../../utils/crypto";
import { PersistentStorage } from "../storage/PersistentStorage";

export class ChainState {
  private state: ChainStateRecord | null = null;

  async initialize(): Promise<void> {
    await PersistentStorage.ensureDirectories();
    const existingState = await PersistentStorage.readChainState();

    if (!existingState) {
      const genesisBlock = this.buildGenesisBlock();
      await PersistentStorage.writeBlock(genesisBlock);

      this.state = {
        latestHeight: genesisBlock.height,
        latestHash: genesisBlock.hash,
        blocks: 1,
        createdAt: genesisBlock.timestamp,
        updatedAt: genesisBlock.timestamp
      };

      await PersistentStorage.writeChainState(this.state);
      return;
    }

    this.state = existingState;
  }

  getState(): ChainStateRecord | null {
    return this.state;
  }

  private buildGenesisBlock(): BlockRecord {
    const transactions = [...GENESIS_TEMPLATE.transactions];
    const timestamp = GENESIS_TEMPLATE.timestamp;
    const merkleRoot = calculateMerkleRoot(transactions);

    const blockWithoutHash = {
      height: 0,
      timestamp,
      proposer: GENESIS_TEMPLATE.proposer,
      previousHash: GENESIS_TEMPLATE.previousHash,
      merkleRoot,
      transactions,
      status: "genesis" as const,
      metadata: GENESIS_TEMPLATE.metadata
    } satisfies Omit<BlockRecord, "hash">;

    const hash = calculateBlockHash(blockWithoutHash);

    return { ...blockWithoutHash, hash };
  }
}
