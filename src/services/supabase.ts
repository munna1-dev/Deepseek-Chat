
import { createClient } from '@supabase/supabase-js'

const url = __SUPABASE_URL__
const key = __SUPABASE_PUBLISHABLE_KEY__

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(
  url || 'https://jdjqmcykbajbpqqcupev.supabase.co',
  key || 'sb_publishable_AOi7HxT0GMIdpxH1qU4jVQ_d2Fcy0be',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
