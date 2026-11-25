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

/** Server-side model tier registry. The frontend MUST NOT classify models. */
export const MODEL_TIERS: Record<string, ModelTier> = {
  'gemini-flash-lite-latest': 'free',
  'gemini-2.5-flash': 'free',
  'deepseek-flash': 'paid',
  'deepseek-v4-pro': 'paid',
}

export const tierOf = (model: string): ModelTier | 'unknown' =>
  MODEL_TIERS[model] ?? 'unknown'

/** Full provider catalogue. Source of truth for tiers and labels. */
export const PROVIDERS: ProviderEntry[] = [
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
      { id: 'deepseek-flash', label: 'DeepSeek Flash', tier: 'paid' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'paid' },
    ],
  },
]
