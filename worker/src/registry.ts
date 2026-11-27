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

/** Server-side model tier registry. Never trust frontend tier declarations. */
export const PROVIDERS: ProviderEntry[] = [
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
    models: [
      { id: 'grok-4.7', label: 'Grok 4.7', tier: 'free' },
    ],
  },
]

export const MODEL_TIERS: Record<string, ModelTier> = Object.fromEntries(
  PROVIDERS.flatMap((provider) =>
    provider.models.map((model) => [model.id, model.tier])
  )
)

export const tierOf = (model: string): ModelTier | 'unknown' =>
  MODEL_TIERS[model] ?? 'unknown'

export const providerOf = (model: string): string | undefined =>
  PROVIDERS.find((provider) =>
    provider.models.some((entry) => entry.id === model)
  )?.id
