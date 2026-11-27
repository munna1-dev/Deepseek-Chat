import { useEffect, useMemo, useState } from 'react'
import { setModel, useSettings } from '../../services/settings.js'
import {
  flattenModels,
  loadProviders,
  resolveModel,
  type ModelOption,
} from '../../services/providers.js'
import { Menu, type MenuOption } from '../base/Menu.js'
import { IconButton } from '../base/IconButton.js'
import { IconGlobeLanguageOutline14 } from '../base/icons.js'

const shorten = (label: string, max = 22): string =>
  label.length <= max ? label : label.slice(0, max - 1) + '…'

/** Visual indicator for the available free models. */
const TierDot = ({ tier }: { tier: 'free' | 'paid' }) => (
  <span
    aria-hidden
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: tier === 'paid' ? '#d69e2e' : '#2ecc71',
    }}
  />
)

export const ModelPicker = () => {
  const selected = useSettings((state) => state.model)
  const allowPaidProviders = useSettings((state) => state.allowPaidProviders)
  const [models, setModels] = useState<ModelOption[]>([])

  useEffect(() => {
    let cancelled = false
    void loadProviders().then((reg) => {
      if (!cancelled) { setModels(flattenModels(reg)) }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const availableModels = models.filter((m) => m.tier === 'free' || allowPaidProviders)
  const currentId = resolveModel(selected ?? undefined)
  const current = availableModels.find((m) => m.id === currentId)
  const triggerLabel = current
    ? shorten(current.label)
    : 'Gemini Flash Lite'

  const options = useMemo<MenuOption[]>(() => {
    return availableModels.map((m) => ({
      key: m.id,
      label: m.tier === 'paid' ? `${m.label} · Paid` : m.label,
      icon: <TierDot tier={m.tier} />,
      onSelect: () => setModel(m.id),
    }))
  }, [availableModels])

  return (
    <Menu options={options}>
      {({ toggle }) => (
        <IconButton
          icon={<IconGlobeLanguageOutline14 />}
          tooltip={triggerLabel}
          onClick={toggle}
        />
      )}
    </Menu>
  )
}
