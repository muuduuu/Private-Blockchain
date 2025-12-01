import { useMemo } from "react"
import { useAuthStore } from "../store/authStore"

export function useWeb3() {
  const { walletAddress, chainId, networkStatus, isConnecting, connectWallet, disconnectWallet, error } = useAuthStore()

  return useMemo(
    () => ({
      walletAddress,
      chainId,
      networkStatus,
      isConnecting,
      error,
      isConnected: Boolean(walletAddress),
      connectWallet,
      disconnectWallet,
    }),
    [walletAddress, chainId, networkStatus, isConnecting, error, connectWallet, disconnectWallet],
  )
}
