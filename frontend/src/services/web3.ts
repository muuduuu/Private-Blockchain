import { BrowserProvider, type Eip1193Provider } from "ethers"

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not available in this browser")
  }

  const provider = new BrowserProvider(window.ethereum as Eip1193Provider)
  const accounts = (await provider.send("eth_requestAccounts", [])) as string[]
  const signer = await provider.getSigner()
  const address = accounts[0] ?? (await signer.getAddress())
  const network = await provider.getNetwork()

  return {
    provider,
    signer,
    address,
    chainId: network.chainId.toString(),
  }
}

export async function signNonce(message: string) {
  if (!window.ethereum) {
    throw new Error("No injected provider available")
  }
  const provider = new BrowserProvider(window.ethereum as Eip1193Provider)
  const signer = await provider.getSigner()
  return signer.signMessage(message)
}

export function listenToAccountChanges(onChange: (accounts: string[]) => void) {
  const handler = (...args: unknown[]) => {
    const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : []
    onChange(accounts)
  }
  window.ethereum?.on?.("accountsChanged", handler)
  return () => window.ethereum?.removeListener?.("accountsChanged", handler)
}

export function listenToChainChanges(onChange: (chainId: string) => void) {
  const handler = (...args: unknown[]) => {
    const chainId = typeof args[0] === "string" ? args[0] : ""
    onChange(chainId)
  }
  window.ethereum?.on?.("chainChanged", handler)
  return () => window.ethereum?.removeListener?.("chainChanged", handler)
}
