import { create } from "zustand"
import { connectWallet as connectWithMetamask, signNonce } from "../services/web3"
import { authenticateWallet, verifyWallet } from "../services/wallet"

interface AuthState {
  walletAddress?: string
  chainId?: string
  networkStatus: "connected" | "disconnected"
  isConnecting: boolean
  error?: string
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  setNetworkStatus: (status: AuthState["networkStatus"]) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  walletAddress: undefined,
  chainId: undefined,
  networkStatus: "disconnected",
  isConnecting: false,
  error: undefined,
  connectWallet: async () => {
    set({ isConnecting: true, error: undefined })
    try {
      const { address, chainId } = await connectWithMetamask()
      const challenge = await authenticateWallet(address)
      const signature = await signNonce(challenge.message)
      await verifyWallet({ address, signature })
      set({ walletAddress: address, chainId, networkStatus: "connected" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet"
      set({ error: message, networkStatus: "disconnected" })
      throw err
    } finally {
      set({ isConnecting: false })
    }
  },
  disconnectWallet: () => set({ walletAddress: undefined, chainId: undefined, networkStatus: "disconnected" }),
  setNetworkStatus: (status) => set({ networkStatus: status }),
}))
