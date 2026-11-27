
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../services/supabase.js'
import { AuthScreen } from './AuthScreen.js'
import styles from './AuthBoundary.module.css'

export const AuthBoundary = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) { return }
      setSession(error ? null : data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return <div className={styles.loading}>Connecting to your secure workspace…</div>
  }

  if (!session) { return <AuthScreen /> }

  return (
    <>
      {children}
      <button className={styles.signOut} onClick={() => void supabase.auth.signOut()}>
        Sign out
      </button>
    </>
  )
}
