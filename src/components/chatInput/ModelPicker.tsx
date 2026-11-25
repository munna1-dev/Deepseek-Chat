import { useEffect, useMemo, useState } from 'react'
import { setAllowPaidProviders, setModel, useSettings } from '../../services/settings.js'
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

/** Tier dot: green for free, red for paid. */
const TierDot = ({ tier }: { tier: 'free' | 'paid' }) => (
  <span
    aria-hidden
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: tier === 'free' ? '#2ecc71' : '#e74c3c',
    }}
  />
)

export const ModelPicker = () => {
  const selected = useSettings((state) => state.model)
  const allowPaid = useSettings((state) => state.allowPaidProviders)
  const [models, setModels] = useState<ModelOption[]>([])

  useEffect(() => {
    let cancelled = false
    void loadProviders().then((reg) => {
      if (!cancelled) setModels(flattenModels(reg))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const currentId = resolveModel(selected ?? undefined)
  const current = models.find((m) => m.id === currentId)
  const triggerLabel = current
    ? shorten(current.label)
    : 'Gemini Flash Lite'

  const options = useMemo<MenuOption[]>(() => {
    return models.map((m) => {
      const blocked = m.tier === 'paid' && !allowPaid
      return {
        key: m.id,
        label: blocked ? `${m.label} (enable paid)` : m.label,
        icon: <TierDot tier={m.tier} />,
        danger: blocked,
        onSelect: () => {
          if (blocked) {
            setAllowPaidProviders(true)
            return
          }
          setModel(m.id)
        },
      }
    })
  }, [models, allowPaid])

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
