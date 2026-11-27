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
let registryCache: Registry | null = null

const DEFAULT_FALLBACK: Registry = {
  providers: [
    {
      id: 'cloudflare',
      label: 'Cloudflare Workers AI',
      models: [
        { id: 'cloudflare-gpt-oss-20b', label: 'GPT OSS 20B · Cloudflare', tier: 'free' },
      ],
    },
    {
      id: 'gemini',
      label: 'Google Gemini',
      models: [
        { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite', tier: 'free' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'free' },
      ],
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      models: [
        { id: 'deepseek-chat', label: 'DeepSeek Chat', tier: 'free' },
        { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', tier: 'free' },
      ],
    },
    {
      id: 'grok',
      label: 'xAI Grok',
      models: [{ id: 'grok-4.7', label: 'Grok 4.7', tier: 'free' }],
    },
  ],
}

export const loadProviders = (): Promise<Registry> => {
  if (!registryPromise) {
    registryPromise = (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/v1/providers`, { method: 'GET' })
        if (!res.ok) {
          registryCache = DEFAULT_FALLBACK
          return DEFAULT_FALLBACK
        }
        const body = (await res.json()) as unknown
        if (
          body &&
          typeof body === 'object' &&
          Array.isArray((body as Registry).providers) &&
          (body as Registry).providers.length > 0
        ) {
          registryCache = body as Registry
          return registryCache
        }
        registryCache = DEFAULT_FALLBACK
        return DEFAULT_FALLBACK
      } catch {
        registryCache = DEFAULT_FALLBACK
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
 * Resolve saved selections against the server registry.
 * Paid models fall back to a free model unless the user opted in.
 */
export const resolveModel = (requested?: string): string => {
  const preferred = requested ?? useSettings.getState().model ?? 'gemini-flash-lite-latest'
  const models = registryCache ? flattenModels(registryCache) : flattenModels(DEFAULT_FALLBACK)
  const match = models.find((model) => model.id === preferred)
  if (!match) {
    return 'gemini-flash-lite-latest'
  }
  if (match.tier === 'paid' && !useSettings.getState().allowPaidProviders) {
    return 'gemini-flash-lite-latest'
  }
  return match.id
}
