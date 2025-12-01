import { ChainState } from "./services/blockchain/ChainState";
import { Mempool } from "./services/blockchain/Mempool";
import { ContextEngine } from "./services/blockchain/ContextEngine";
import { BLOCKS_DIR, CHAIN_DIR, DATA_ROOT, DEMO_METAMASK_ADDRESS } from "./config/constants";
import { AuditLogService } from "./services/compliance/AuditLogService";
import { WalletRegistry } from "./services/wallet/WalletRegistry";
import { WalletAuthService } from "./services/wallet/WalletAuthService";
import { buildServer } from "./server/app";
import http from "http";
import dotenv from "dotenv";
import { ReferenceDirectory } from "./services/reference/ReferenceDirectory";

dotenv.config();

async function bootstrap() {
  const chainState = new ChainState();
  await chainState.initialize();

  const mempool = new Mempool();
  await mempool.initialize();

  const contextEngine = new ContextEngine({
    statsProvider: () => mempool.getQueueStats()
  });

  const auditLog = new AuditLogService();
  await auditLog.initialize();

  await auditLog.record({
    action: "System.Bootstrap",
    actorId: "camtc-node",
    actorType: "system",
    resource: "ledger.bootstrap",
    outcome: "success",
    details: "File-based ledger initialized",
    tags: ["startup", "healthcheck"],
    channel: "node"
  });

  const walletRegistry = new WalletRegistry();
  await walletRegistry.initialize();

  const walletAuth = new WalletAuthService(walletRegistry);
  await walletAuth.initialize();

  const referenceDirectory = new ReferenceDirectory();
  await referenceDirectory.initialize();

  if (DEMO_METAMASK_ADDRESS) {
    try {
      const challenge = await walletAuth.issueNonce(DEMO_METAMASK_ADDRESS, { label: "Demo MetaMask" });
      console.log("🪙 Demo MetaMask challenge issued:", {
        address: challenge.wallet.address,
        nonce: challenge.nonce,
        expiresAt: challenge.expiresAt
      });
    } catch (error) {
      console.warn("⚠️ Unable to issue demo wallet challenge", error);
    }
  }

  const recentAudit = await auditLog.query({ limit: 1 });

  const snapshot = chainState.getState();

  console.log("✅ File-based ledger initialized");
  console.log(`📁 DATA_ROOT: ${DATA_ROOT}`);
  console.log(`📁 CHAIN_DIR: ${CHAIN_DIR}`);
  console.log(`📁 BLOCKS_DIR: ${BLOCKS_DIR}`);
  console.log("📊 Chain State:", snapshot);
  console.log("🧾 Mempool queues:", mempool.getQueueStats());
  if (recentAudit.entries[0]) {
    console.log("🪵 Latest audit entry:", recentAudit.entries[0]);
  }

  const app = buildServer({
    chainState,
    mempool,
    contextEngine,
    auditLog,
    walletRegistry,
    walletAuth,
    referenceDirectory
  });

  const port = Number(process.env.PORT ?? 4000);
  const server = http.createServer(app);
  server.listen(port, () => {
    console.log(`🚀 REST API listening on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("❌ Failed to bootstrap chain", error);
  process.exit(1);
});
