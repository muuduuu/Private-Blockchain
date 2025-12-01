const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

export async function authenticateWallet(address: string) {
  await wait()
  return {
    nonce: `CAMTC-AUTH-${Date.now()}`,
    message: `Authenticate CAMTC Healthcare Dashboard for ${address}`,
  }
}

export async function verifyWallet(payload: { address: string; signature: string }) {
  await wait(400)
  return {
    success: true,
    address: payload.address,
    issuedAt: new Date().toISOString(),
  }
}
