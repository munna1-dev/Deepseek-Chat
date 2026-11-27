import { useState, type FormEvent } from 'react'
import { supabase } from '../../services/supabase.js'
import styles from './AuthScreen.module.css'

type Mode = 'login' | 'register' | 'reset'

export const AuthScreen = () => {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const changeMode = (next: Mode) => {
    setMode(next)
    setError('')
    setMessage('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'register') {
        if (name.trim().length < 2) {
          throw new Error('Please enter your full name.')
        }
        if (password.length < 8) {
          throw new Error('Password must contain at least 8 characters.')
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) { throw error }

        if (data.session) {
          setMessage('Your account has been created successfully.')
        } else {
          setMessage('Account created. Check your email to verify your address before signing in.')
          setMode('login')
        }
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error) { throw error }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: window.location.origin }
        )
        if (error) { throw error }
        setMessage('If an account exists for this email, a password reset link will be sent.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.authCard}>
        <aside className={styles.visualPanel}>
          <div className={styles.visualBrand}>
            <span className={styles.visualLogo}>D</span>
            <span>DeepSeek Chat</span>
          </div>

          <div className={styles.visualMain}>
            <span className={styles.visualEyebrow}>YOUR AI WORKSPACE</span>
            <h1>Welcome to<br />DeepSeek Chat</h1>
            <p>Your gateway to clearer thinking, deeper research and effortless creativity.</p>
          </div>

          <div className={styles.visualBottom}>
            <h2>Ideas move further together.</h2>
            <p>Explore, create and solve problems with your AI workspace.</p>
            <div className={styles.slideDots} aria-label="Welcome">
              <span className={styles.activeDot} />
              <span />
              <span />
            </div>
          </div>
          <div className={`${styles.wave} ${styles.waveOne}`} />
          <div className={`${styles.wave} ${styles.waveTwo}`} />
          <div className={`${styles.wave} ${styles.waveThree}`} />
        </aside>

        <section className={styles.formPanel}>
          <div className={styles.mobileBrand}>
            <span className={styles.mobileLogo}>D</span>
            <span>DeepSeek Chat</span>
          </div>

          <div className={styles.formContent}>
            <div className={styles.formBrand}>
              <span className={styles.brandMark}>D</span>
              <span>DeepSeek Chat</span>
            </div>

            {mode !== 'reset' ? (
              <div className={styles.tabs} role="tablist" aria-label="Account access">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  className={mode === 'login' ? styles.activeTab : ''}
                  onClick={() => changeMode('login')}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  className={mode === 'register' ? styles.activeTab : ''}
                  onClick={() => changeMode('register')}
                >
                  Sign up
                </button>
              </div>
            ) : (
              <button type="button" className={styles.back} onClick={() => changeMode('login')}>
                ← Back to sign in
              </button>
            )}

            <div className={styles.heading}>
              <span className={styles.eyebrow}>
                {mode === 'register' ? 'CREATE YOUR ACCOUNT' :
                  mode === 'reset' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}
              </span>
              <h2>
                {mode === 'register' ? 'Create your account' :
                  mode === 'reset' ? 'Reset your password' : 'Sign in to continue'}
              </h2>
              <p>
                {mode === 'register' ? 'Start exploring your AI workspace today.' :
                  mode === 'reset' ? 'Enter your email and we will send you a recovery link.' :
                    'Continue your conversations and pick up where you left off.'}
              </p>
            </div>

            <form onSubmit={submit} className={styles.form}>
              {mode === 'register' && (
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              {mode !== 'reset' && (
                <label>
                  <span className={styles.passwordLabel}>
                    Password
                    {mode === 'login' && (
                      <button
                        type="button"
                        className={styles.forgot}
                        onClick={() => changeMode('reset')}
                      >
                        Forgot password?
                      </button>
                    )}
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={8}
                    required
                  />
                </label>
              )}

              {error && <div className={styles.error} role="alert">{error}</div>}
              {message && <div className={styles.success} role="status">{message}</div>}

              <button className={styles.submit} type="submit" disabled={busy}>
                {busy ? 'Please wait…' :
                  mode === 'register' ? 'Create account' :
                    mode === 'reset' ? 'Send recovery link' : 'Sign in'}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            {mode !== 'reset' && (
              <p className={styles.switchText}>
                {mode === 'register' ? 'Already have an account?' : "Don't have an account yet?"}
                {' '}
                <button
                  type="button"
                  onClick={() => changeMode(mode === 'register' ? 'login' : 'register')}
                >
                  {mode === 'register' ? 'Sign in' : 'Create account'}
                </button>
              </p>
            )}

            <div className={styles.securityNote}>
              <span className={styles.lockIcon}>◇</span>
              Your account and conversations are protected.
            </div>
          </div>

          <footer className={styles.footer}>
            <span>DEEPSEEK CHAT</span>
            <span>Built for ideas without limits.</span>
          </footer>
        </section>
      </section>
    </main>
  )
}
