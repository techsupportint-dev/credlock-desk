import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_USERS, type UserAccount } from '../lib/mockData'
import { supabaseConfigured, getSupabaseConfigHint } from '../lib/supabase'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleLogin(userEmail: string, userPass: string) {
    setError(null)
    setBusy(true)
    const err = await signIn(userEmail.trim(), userPass)
    setBusy(false)
    if (err) setError(err)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await handleLogin(email, password)
  }

  function quickSelectUser(user: UserAccount) {
    setEmail(user.email)
    setPassword(user.passcode)
    handleLogin(user.email, user.passcode)
  }

  return (
    <div className="login-screen" style={{ flexDirection: 'column', gap: 24, padding: '24px 16px' }}>
      <form
        className="login-panel card"
        onSubmit={onSubmit}
        style={{ width: 'min(460px, 100%)', padding: 28 }}
      >
        <div className="login-brand">
          <div className="brand-mark lg">CL</div>
          <div>
            <h2 style={{ margin: '0 0 2px' }}>CredLock Technical Support</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Operations Portal · Tickets, Incidents & Device Ops
            </p>
          </div>
        </div>

        {!supabaseConfigured && <div className="auth-error">{getSupabaseConfigHint()}</div>}
        {error && <div className="auth-error">{error}</div>}

        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="officer@credlock.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password" style={{ marginTop: 12 }}>
          Passcode / Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter passcode (e.g. CredLock@2026)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          className="btn"
          style={{
            width: '100%',
            marginTop: 18,
            fontWeight: 600,
            fontSize: 14,
            padding: '10px 16px',
          }}
          disabled={busy}
          type="submit"
        >
          {busy ? 'Authenticating…' : 'Sign in to Portal'}
        </button>

        <p className="muted login-foot" style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 12 }}>
          Protected portal. Use your provisioned staff passcode or select a role below.
        </p>
      </form>

      {/* Staff User Accounts & Passcode Directory */}
      <div
        className="card"
        style={{
          width: 'min(780px, 100%)',
          padding: 20,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>👥</span> Staff Accounts & Passcodes Directory
            </h3>
            <span className="muted" style={{ fontSize: 12 }}>
              Default system passcode for all staff accounts: <strong style={{ color: 'var(--acc)' }}>CredLock@2026</strong> (or PIN <strong style={{ color: 'var(--acc)' }}>123456</strong>)
            </span>
          </div>
          <span className="chip b" style={{ fontSize: 11 }}>
            6 Provisioned Roles
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: 10,
          }}
        >
          {DEFAULT_USERS.map((u) => {
            const roleColor =
              u.role === 'Super Admin'
                ? 'r'
                : u.role === 'Team Lead'
                ? 'y'
                : u.role === 'Officer'
                ? 'b'
                : 'g'

            return (
              <div
                key={u.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: 12,
                  background: 'var(--bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--ink)',
                      }}
                    >
                      {u.full_name}
                    </span>
                    <span className={`chip ${roleColor}`} style={{ fontSize: 10 }}>
                      {u.role}
                    </span>
                  </div>

                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                    {u.department} · {u.staff_id}
                  </div>

                  <div className="mono" style={{ fontSize: 11, color: 'var(--mute)', wordBreak: 'break-all' }}>
                    {u.email}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    <span className="muted">Passcode: </span>
                    <code className="mono" style={{ color: 'var(--acc)', fontWeight: 600 }}>
                      {u.passcode}
                    </code>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn sec"
                  onClick={() => quickSelectUser(u)}
                  disabled={busy}
                  style={{
                    width: '100%',
                    fontSize: 12,
                    padding: '6px 10px',
                    minHeight: 32,
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                >
                  ⚡ Quick Sign In as {u.role}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
