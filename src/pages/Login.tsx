import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabaseConfigured, getSupabaseConfigHint } from '../lib/supabase'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const err = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="login-screen">
      <form className="login-panel card" onSubmit={onSubmit}>
        <div className="login-brand">
          <div className="brand-mark lg">CL</div>
          <div>
            <h2>CredLock Technical Support</h2>
            <p className="muted">Tickets · incidents · device ops · KAVRO</p>
          </div>
        </div>
        {!supabaseConfigured && (
          <div className="auth-error">{getSupabaseConfigHint()}</div>
        )}
        {error && <div className="auth-error">{error}</div>}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted login-foot">Accounts are provisioned by Super Admin.</p>
      </form>
    </div>
  )
}
