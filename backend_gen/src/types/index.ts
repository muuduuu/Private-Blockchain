export interface TransactionRecord {
  id: string;
  type: string;
  tier: number;
  priority: number;
  payload: Record<string, unknown>;
  signature: string;
  createdAt: string;
}

export interface BlockRecord {
  hash: string;
  height: number;
  timestamp: string;
  proposer: string;
  previousHash: string;
  merkleRoot: string;
  transactions: TransactionRecord[];
  status: "genesis" | "proposed" | "finalized";
  metadata?: Record<string, unknown>;
}

export interface ChainStateRecord {
  latestHeight: number;
  latestHash: string;
  blocks: number;
  createdAt: string;
  updatedAt: string;
}

export interface ValidatorProfile {
  id: string;
  address: string;
  publicKey: string;
  privateKey: string;
  stake: number;
  reputation: number;
  latency?: number;
  tier?: number;
  isActive: boolean;
}

export interface MempoolTierStats {
  size: number;
  capacity: number;
}

export interface MempoolStats {
  tier1: MempoolTierStats;
  tier2: MempoolTierStats;
  tier3: MempoolTierStats;
  validatorsOnline: number;
  validatorsTotal: number;
}

export interface PriorityBreakdownSnapshot {
  criticality: number;
  sensitivity: number;
  resources: number;
  compliance: number;
  priority: number;
}

export interface MempoolEntry {
  id: string;
  tx: TransactionRecord;
  tier: 1 | 2 | 3;
  priority: number;
  breakdown: PriorityBreakdownSnapshot;
  addedAt: string;
}

export interface MempoolSnapshot {
  tier1: MempoolEntry[];
  tier2: MempoolEntry[];
  tier3: MempoolEntry[];
}

export type AuditAction = "Create" | "Read" | "Update" | "Delete" | "Access" | "System";
export type AuditOutcome = "success" | "failed" | "blocked";

export interface AuditLogEntry {
  id: string;
  sequence: number;
  timestamp: string;
  action: AuditAction | string;
  actorId: string;
  actorType: string;
  resource: string;
  outcome: AuditOutcome | string;
  patientId?: string;
  ipAddress?: string;
  blockHash?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  channel?: string;
  prevHash: string;
  integrityHash: string;
}

export interface AuditLogRecordInput {
  id?: string;
  timestamp?: string;
  action: AuditAction | string;
  actorId: string;
  actorType: string;
  resource: string;
  outcome: AuditOutcome | string;
  patientId?: string;
  ipAddress?: string;
  blockHash?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  channel?: string;
}

export interface AuditLogFilters {
  actorId?: string;
  actorType?: string;
  patientId?: string;
  resource?: string;
  action?: string;
  outcome?: string;
  from?: string;
  to?: string;
  search?: string;
  tags?: string[];
}

export interface AuditLogQueryOptions {
  filters?: AuditLogFilters;
  limit?: number;
  cursor?: string;
  direction?: "asc" | "desc";
}

export interface AuditLogQueryResult {
  entries: AuditLogEntry[];
  totalMatches: number;
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
}

export type WalletType = "metamask" | "custom";
export type WalletStatus = "active" | "revoked" | "suspended";

export interface WalletProfile {
  id: string;
  address: string;
  addressNormalized: string;
  type: WalletType;
  label?: string;
  publicKey?: string;
  metadata?: Record<string, unknown>;
  roles?: string[];
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

export interface WalletRegistrationInput {
  address: string;
  type: WalletType;
  label?: string;
  publicKey?: string;
  metadata?: Record<string, unknown>;
  roles?: string[];
  status?: WalletStatus;
}

export interface WalletNonceRecord {
  address: string;
  addressNormalized: string;
  nonce: string;
  message: string;
  walletType: WalletType;
  issuedAt: string;
  expiresAt: string;
  context?: Record<string, unknown>;
}

export interface WalletNonceStore {
  [addressNormalized: string]: WalletNonceRecord;
}

export interface WalletChallengeResponse {
  nonce: string;
  message: string;
  expiresAt: string;
  wallet: WalletProfile;
}

export interface WalletVerificationResult {
  success: boolean;
  wallet: WalletProfile;
  verifiedAt: string;
  sessionToken: string;
  proof: string;
}
