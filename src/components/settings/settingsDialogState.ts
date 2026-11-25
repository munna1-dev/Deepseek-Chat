import { create } from 'zustand'

export type SettingsSection = 'general' | 'data'

export const useSettingsDialog = create(() => ({
  open: false,
  section: 'general' as SettingsSection,
}))

export const openSettings = (section: SettingsSection) =>
  useSettingsDialog.setState({ open: true, section })

export const closeSettings = () => useSettingsDialog.setState({ open: false })

/** API authentication is managed by the server-side proxy. */
export const ensureApiKey = () => true
