import { API_ORIGIN } from './api/client.js'
import { useSettings } from './settings.js'

export type ModelTier = 'free' | 'paid'

export type ModelEntry = {
  id: string
  label: string
  tier: ModelTier
}

export type ProviderEntry = {
  id: string
  label: string
  models: ModelEntry[]
}

export type ModelOption = ModelEntry & { providerId: string; providerLabel: string }

type Registry = {
  providers: ProviderEntry[]
}

/** Registry fetched once from the Worker. The Worker is the only source of truth for tiers. */
let registryPromise: Promise<Registry> | null = null

const DEFAULT_FALLBACK: Registry = {
  providers: [
    {
      id: 'gemini',
      label: 'Google Gemini',
      models: [{ id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite', tier: 'free' }],
    },
  ],
}

export const loadProviders = (): Promise<Registry> => {
  if (!registryPromise) {
    registryPromise = (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/v1/providers`, { method: 'GET' })
        if (!res.ok) return DEFAULT_FALLBACK
        const body = (await res.json()) as unknown
        if (
          body &&
          typeof body === 'object' &&
          Array.isArray((body as Registry).providers) &&
          (body as Registry).providers.length > 0
        ) {
          return body as Registry
        }
        return DEFAULT_FALLBACK
      } catch {
        return DEFAULT_FALLBACK
      }
    })()
  }
  return registryPromise
}

/** Flatten registry into a linear list the picker can render. */
export const flattenModels = (reg: Registry): ModelOption[] =>
  reg.providers.flatMap((p) =>
    p.models.map((m) => ({ ...m, providerId: p.id, providerLabel: p.label }))
  )

export const findModel = (reg: Registry, id: string): ModelOption | undefined =>
  flattenModels(reg).find((m) => m.id === id)

/**
 * Resolve which model to send. Order of precedence:
 *   1. explicit user selection in settings
 *   2. hard fallback (free Gemini)
 * Refuses paid models unless allowPaidProviders is on — same rule as the Worker gate.
 */
export const resolveModel = (requested?: string): string => {
  const settings = useSettings.getState()
  const preferred = requested ?? settings.model ?? 'gemini-flash-lite-latest'
  // We don't have synchronous tier info here; trust the Worker to reject.
  // But if the flag is off and the id looks paid by convention, downgrade.
  if (!settings.allowPaidProviders && /^deepseek-/.test(preferred)) {
    return 'gemini-flash-lite-latest'
  }
  return preferred
}
