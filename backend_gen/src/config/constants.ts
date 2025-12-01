import path from "path";
import { config as loadEnv } from "dotenv";

loadEnv();

const parseNumber = (value: string | undefined, fallback: number): number => {
	if (!value) return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const NETWORK_ID = process.env.NETWORK_ID || "camtc-demo";
export const DATA_ROOT = path.resolve(process.env.DATA_ROOT || path.join(process.cwd(), "data_storage"));

export const CHAIN_DIR = path.join(DATA_ROOT, NETWORK_ID, "chain");
export const BLOCKS_DIR = path.join(CHAIN_DIR, "blocks");
export const STATE_FILE = path.join(CHAIN_DIR, "state.json");
export const GENESIS_FILE = path.join(BLOCKS_DIR, "000000_genesis.json");
export const MEMPOOL_FILE = path.join(CHAIN_DIR, "mempool.json");

export const AUDIT_DIR = path.join(CHAIN_DIR, "audit");
export const AUDIT_EXPORT_DIR = path.join(AUDIT_DIR, "exports");
export const AUDIT_LOG_FILE = path.join(AUDIT_DIR, "audit-log.jsonl");

export const WALLETS_DIR = path.join(CHAIN_DIR, "wallets");
export const WALLET_REGISTRY_FILE = path.join(WALLETS_DIR, "wallets.json");
export const WALLET_NONCE_FILE = path.join(WALLETS_DIR, "nonces.json");

export const API_PREFIX = process.env.API_PREFIX || "/api";

export const REFERENCE_DIR = path.join(CHAIN_DIR, "reference");
export const REFERENCE_DATA_FILE = path.join(REFERENCE_DIR, "directory.json");

export const FILE_ENCODING: BufferEncoding = "utf-8";

export const MEMPOOL_CAPACITY = {
	tier1: 100,
	tier2: 2000,
	tier3: 8000
} as const;

export const AUDIT_RETENTION_DAYS = parseNumber(process.env.AUDIT_RETENTION_DAYS, 90);
export const AUDIT_LOG_MAX_BYTES = parseNumber(process.env.AUDIT_LOG_MAX_BYTES, 5 * 1024 * 1024); // 5 MB default
export const WALLET_NONCE_TTL_SECONDS = parseNumber(process.env.WALLET_NONCE_TTL_SECONDS, 300);

export const DEMO_METAMASK_ADDRESS = process.env.DEMO_METAMASK_ADDRESS || "";
