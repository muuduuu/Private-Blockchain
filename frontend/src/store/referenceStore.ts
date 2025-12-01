import { create } from "zustand"
import { ApiService } from "../services/api"
import type { ProviderOption } from "../types"

interface ReferenceState {
  providers: ProviderOption[]
  patientIds: string[]
  loading: boolean
  hydrate: () => Promise<void>
}

export const useReferenceStore = create<ReferenceState>((set, get) => ({
  providers: [],
  patientIds: [],
  loading: false,
  hydrate: async () => {
    const state = get()
    if (state.loading) return
    if (state.providers.length > 0 && state.patientIds.length > 0) return
    set({ loading: true })
    try {
      const [providers, patients] = await Promise.all([
        ApiService.fetchProviders(),
        ApiService.fetchPatients(),
      ])
      set({ providers, patientIds: patients })
    } finally {
      set({ loading: false })
    }
  },
}))
