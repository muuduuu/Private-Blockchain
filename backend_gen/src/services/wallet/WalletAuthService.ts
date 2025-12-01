import { promises as fs } from "fs";
import { constants as CryptoConstants, randomUUID, verify as cryptoVerify } from "crypto";
import { getAddress, verifyMessage } from "ethers";
import {
  FILE_ENCODING,
  WALLET_NONCE_FILE,
  WALLET_NONCE_TTL_SECONDS,
  WALLETS_DIR
} from "../../config/constants";
import {
  WalletChallengeResponse,
  WalletNonceRecord,
  WalletNonceStore,
  WalletProfile,
  WalletType,
  WalletVerificationResult
} from "../../types";
import { sha256 } from "../../utils/crypto";
import { WalletRegistry } from "./WalletRegistry";

interface IssueNonceOptions {
  walletType?: WalletType;
  autoRegister?: boolean;
  label?: string;
  context?: Record<string, unknown>;
  messageOverride?: string;
  ttlSeconds?: number;
  customPublicKey?: string;
  metadata?: Record<string, unknown>;
}

export class WalletAuthService {
  private registry: WalletRegistry;
  private logger: typeof console;
  private nonceStore: WalletNonceStore = {};

  constructor(registry: WalletRegistry, logger: typeof console = console) {
    this.registry = registry;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(WALLETS_DIR, { recursive: true });
    await this.loadNonceStore();
    await this.cleanupExpiredNonces();
  }

  async issueNonce(address: string, options: IssueNonceOptions = {}): Promise<WalletChallengeResponse> {
    const normalized = this.normalize(address);
    const ttl = (options.ttlSeconds ?? WALLET_NONCE_TTL_SECONDS) * 1000;
    if (ttl <= 0) {
      throw new Error("Nonce TTL must be positive");
    }

    let wallet = this.registry.getWallet(address);
    const resolvedType: WalletType = options.walletType ?? wallet?.type ?? "metamask";

    if (!wallet) {
      if (resolvedType === "metamask" && options.autoRegister !== false) {
        wallet = await this.registry.upsertMetamask(address, options.label);
      } else if (resolvedType === "custom") {
        if (!options.customPublicKey) {
          throw new Error("custom wallets require customPublicKey on first registration");
        }
        wallet = await this.registry.register({
          address,
          type: "custom",
          publicKey: options.customPublicKey,
          label: options.label,
          metadata: options.metadata
        });
      } else {
        throw new Error(`Wallet ${address} not found and automatic registration disabled`);
      }
    }

    if (wallet.type !== resolvedType) {
      throw new Error(`Wallet type mismatch. Expected ${wallet.type}, received ${resolvedType}`);
    }

    const nonce = `CAMTC-${randomUUID()}`;
    const message = options.messageOverride ?? this.buildChallengeMessage(wallet.address, nonce);
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttl).toISOString();

    const record: WalletNonceRecord = {
      address: wallet.address,
      addressNormalized: wallet.addressNormalized,
      nonce,
      message,
      walletType: wallet.type,
      issuedAt,
      expiresAt,
      context: options.context
    };

    this.nonceStore[normalized] = record;
    await this.persistNonceStore();

    this.logger.info(`[WalletAuth] Issued nonce for ${wallet.address} (${wallet.type})`);
    return {
      nonce,
      message,
      expiresAt,
      wallet
    };
  }

  async verifySignature(address: string, signature: string): Promise<WalletVerificationResult> {
    const wallet = this.registry.getWallet(address);
    if (!wallet) {
      throw new Error(`Wallet ${address} is not registered`);
    }

    const normalized = wallet.addressNormalized;
    const nonceRecord = this.nonceStore[normalized];
    if (!nonceRecord) {
      throw new Error("No active nonce for wallet. Request a new challenge.");
    }

    if (Date.now() > Date.parse(nonceRecord.expiresAt)) {
      delete this.nonceStore[normalized];
      await this.persistNonceStore();
      throw new Error("Nonce expired. Request a new challenge.");
    }

    const message = nonceRecord.message;
    let verified = false;

    if (wallet.type === "metamask") {
      verified = await this.verifyMetamaskSignature(wallet, message, signature);
    } else {
      verified = this.verifyCustomSignature(wallet, message, signature);
    }

    if (!verified) {
      throw new Error("Signature verification failed");
    }

    delete this.nonceStore[normalized];
    await this.persistNonceStore();
    await this.registry.touch(wallet.address);

    const verifiedAt = new Date().toISOString();
    const sessionToken = sha256(`${wallet.id}:${nonceRecord.nonce}:${verifiedAt}`);
    const proof = sha256(`${signature}:${message}`);

    this.logger.info(`[WalletAuth] Verified wallet ${wallet.address}`);
    return {
      success: true,
      wallet,
      verifiedAt,
      sessionToken,
      proof
    };
  }

  async cleanupExpiredNonces(): Promise<void> {
    const now = Date.now();
    const before = Object.keys(this.nonceStore).length;
    Object.entries(this.nonceStore).forEach(([key, record]) => {
      if (Date.parse(record.expiresAt) < now) {
        delete this.nonceStore[key];
      }
    });
    const after = Object.keys(this.nonceStore).length;
    if (before !== after) {
      await this.persistNonceStore();
      this.logger.warn(`[WalletAuth] Cleaned ${before - after} expired nonce(s)`);
    }
  }

  private async loadNonceStore(): Promise<void> {
    try {
      const raw = await fs.readFile(WALLET_NONCE_FILE, FILE_ENCODING);
      this.nonceStore = JSON.parse(raw) as WalletNonceStore;
    } catch {
      this.nonceStore = {};
      await this.persistNonceStore();
    }
  }

  private async persistNonceStore(): Promise<void> {
    await fs.writeFile(WALLET_NONCE_FILE, JSON.stringify(this.nonceStore, null, 2), FILE_ENCODING);
  }

  private buildChallengeMessage(address: string, nonce: string): string {
    return [
      "CAMTC Healthcare Ledger",
      "Sign this message to authenticate",
      `Wallet: ${address}`,
      `Nonce: ${nonce}`,
      `Timestamp: ${new Date().toISOString()}`
    ].join("\n");
  }

  private async verifyMetamaskSignature(wallet: WalletProfile, message: string, signature: string): Promise<boolean> {
    try {
      const recovered = getAddress(verifyMessage(message, signature));
      return recovered.toLowerCase() === wallet.addressNormalized;
    } catch (error) {
      this.logger.error("[WalletAuth] Failed to verify MetaMask signature", error);
      return false;
    }
  }

  private verifyCustomSignature(wallet: WalletProfile, message: string, signature: string): boolean {
    if (!wallet.publicKey) {
      throw new Error("Custom wallet is missing a publicKey");
    }

    const scheme = (wallet.metadata?.scheme as string) || "ed25519";
    const data = Buffer.from(message);
    const sig = this.decodeSignature(signature);

    try {
      if (scheme === "ed25519") {
        return cryptoVerify(null, data, wallet.publicKey, sig);
      }

      if (scheme === "rsa-pss") {
        return cryptoVerify(
          "sha256",
          data,
          { key: wallet.publicKey, padding: CryptoConstants.RSA_PKCS1_PSS_PADDING },
          sig
        );
      }

      throw new Error(`Unsupported custom wallet scheme: ${scheme}`);
    } catch (error) {
      this.logger.error("[WalletAuth] Custom wallet verification failed", error);
      return false;
    }
  }

  private decodeSignature(signature: string): Buffer {
    if (signature.startsWith("0x")) {
      return Buffer.from(signature.slice(2), "hex");
    }
    return Buffer.from(signature, "base64");
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }
}
