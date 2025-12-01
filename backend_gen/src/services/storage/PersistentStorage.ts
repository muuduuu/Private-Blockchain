import { promises as fs } from "fs";
import path from "path";
import { BLOCKS_DIR, CHAIN_DIR, DATA_ROOT, FILE_ENCODING, GENESIS_FILE, STATE_FILE } from "../../config/constants";
import { BlockRecord, ChainStateRecord } from "../../types";

export class PersistentStorage {
  static async ensureDirectories(): Promise<void> {
    await fs.mkdir(DATA_ROOT, { recursive: true });
    await fs.mkdir(CHAIN_DIR, { recursive: true });
    await fs.mkdir(BLOCKS_DIR, { recursive: true });
  }

  static async writeBlock(block: BlockRecord): Promise<void> {
    const filename = block.height === 0 ? GENESIS_FILE : path.join(BLOCKS_DIR, `${block.height.toString().padStart(6, "0")}.json`);
    await fs.writeFile(filename, JSON.stringify(block, null, 2), FILE_ENCODING);
  }

  static async readBlock(height: number): Promise<BlockRecord | null> {
    const filename = height === 0 ? GENESIS_FILE : path.join(BLOCKS_DIR, `${height.toString().padStart(6, "0")}.json`);
    try {
      const raw = await fs.readFile(filename, FILE_ENCODING);
      return JSON.parse(raw) as BlockRecord;
    } catch (error) {
      return null;
    }
  }

  static async writeChainState(state: ChainStateRecord): Promise<void> {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), FILE_ENCODING);
  }

  static async readChainState(): Promise<ChainStateRecord | null> {
    try {
      const raw = await fs.readFile(STATE_FILE, FILE_ENCODING);
      return JSON.parse(raw) as ChainStateRecord;
    } catch (error) {
      return null;
    }
  }
}
