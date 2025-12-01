import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { FILE_ENCODING, WALLET_REGISTRY_FILE, WALLETS_DIR } from "../../config/constants";
import { WalletProfile, WalletRegistrationInput, WalletStatus } from "../../types";

interface WalletRegistryState {
  wallets: Record<string, WalletProfile>;
  updatedAt: string;
  version: string;
}

const REGISTRY_VERSION = "1.0.0";

export class WalletRegistry {
  private logger: typeof console;
  private state: WalletRegistryState = {
    wallets: {},
    updatedAt: new Date().toISOString(),
    version: REGISTRY_VERSION
  };

  constructor(logger: typeof console = console) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(WALLETS_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(WALLET_REGISTRY_FILE, FILE_ENCODING);
      const parsed = JSON.parse(raw) as WalletRegistryState;
      this.state = parsed;
      this.logger.info(`[WalletRegistry] Loaded ${Object.keys(parsed.wallets).length} wallets`);
    } catch (error) {
      this.logger.warn("[WalletRegistry] No registry found, creating new ledger");
      await this.persist();
    }
  }

  listWallets(): WalletProfile[] {
    return Object.values(this.state.wallets);
  }

  getWallet(address: string): WalletProfile | null {
    const normalized = this.normalize(address);
    return this.state.wallets[normalized] ?? null;
  }

  async register(input: WalletRegistrationInput): Promise<WalletProfile> {
    const normalized = this.normalize(input.address);
    const existing = this.state.wallets[normalized];
    if (existing) {
      return existing;
    }

    if (input.type === "custom" && !input.publicKey) {
      throw new Error("Custom wallets require a publicKey for signature verification");
    }

    const timestamp = new Date().toISOString();
    const profile: WalletProfile = {
      id: `wallet-${randomUUID()}`,
      address: input.address,
      addressNormalized: normalized,
      type: input.type,
      label: input.label,
      publicKey: input.publicKey,
      metadata: input.metadata,
      roles: input.roles ?? ["clinician"],
      status: input.status ?? "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.state.wallets[normalized] = profile;
    await this.persist();
    this.logger.info(`[WalletRegistry] Registered ${input.type} wallet ${input.address}`);
    return profile;
  }

  async upsertMetamask(address: string, label?: string): Promise<WalletProfile> {
    const existing = this.getWallet(address);
    if (existing) {
      return existing;
    }
    return this.register({ address, type: "metamask", label });
  }

  async update(address: string, updates: Partial<Omit<WalletProfile, "id" | "address" | "addressNormalized" | "createdAt">>): Promise<WalletProfile> {
    const normalized = this.normalize(address);
    const current = this.state.wallets[normalized];
    if (!current) {
      throw new Error(`Wallet ${address} not found`);
    }

    const updated: WalletProfile = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.state.wallets[normalized] = updated;
    await this.persist();
    return updated;
  }

  async touch(address: string): Promise<void> {
    const normalized = this.normalize(address);
    const current = this.state.wallets[normalized];
    if (!current) {
      return;
    }
    current.lastSeenAt = new Date().toISOString();
    current.updatedAt = current.lastSeenAt;
    await this.persist();
  }

  async setStatus(address: string, status: WalletStatus): Promise<WalletProfile> {
    return this.update(address, { status });
  }

  private normalize(address: string): string {
    return address.trim().toLowerCase();
  }

  private async persist(): Promise<void> {
    this.state.updatedAt = new Date().toISOString();
    this.state.version = REGISTRY_VERSION;
    await fs.writeFile(WALLET_REGISTRY_FILE, JSON.stringify(this.state, null, 2), FILE_ENCODING);
  }
}
