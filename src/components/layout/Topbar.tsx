import { useAuth } from '../../context/AuthContext'

interface Props {
  title: string
  onMenuClick: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function Topbar({ title, onMenuClick, theme, onToggleTheme }: Props) {
  const { profile, role, signOut } = useAuth()
  const who = profile?.full_name || profile?.email || ''

  return (
    <header className="topbar">
      <button type="button" className="btn sec icon-btn" onClick={onMenuClick} aria-label="Toggle menu">
        ☰
      </button>
      <div className="topbar-title">
        <h1>{title}</h1>
        <p className="topbar-sub muted">Live operations · Supabase</p>
      </div>
      <div className="topbar-actions">
        <span className="who hide-sm">
          {who} · {role}
        </span>
        <button type="button" className="btn sec" onClick={onToggleTheme}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button type="button" className="btn sec" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </header>
  )
}
