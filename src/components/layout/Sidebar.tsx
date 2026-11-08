import { useAuth } from '../../context/AuthContext'
import type { TabId } from '../../types'

interface NavItem {
  tab: TabId
  label: string
  icon: string
  group: 'ops' | 'tech' | 'mgmt'
}

const NAV: NavItem[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: '◈', group: 'ops' },
  { tab: 'tickets', label: 'Tickets', icon: '▣', group: 'ops' },
  { tab: 'officers', label: 'Officers', icon: '◎', group: 'ops' },
  { tab: 'deviceops', label: 'Device Ops', icon: '⬡', group: 'tech' },
  { tab: 'kavro', label: 'KAVRO', icon: '⬢', group: 'tech' },
  { tab: 'incidents', label: 'Incidents', icon: '⚠', group: 'tech' },
  { tab: 'documents', label: 'Documents', icon: '📄', group: 'mgmt' },
  { tab: 'reports', label: 'Reports', icon: '▥', group: 'mgmt' },
  { tab: 'team', label: 'Team', icon: '👤', group: 'mgmt' },
]

const GROUPS = [
  { id: 'ops' as const, title: 'Operations' },
  { id: 'tech' as const, title: 'Technical' },
  { id: 'mgmt' as const, title: 'Management' },
]

interface Props {
  activeTab: TabId
  onTabChange: (t: TabId) => void
}

export function Sidebar({ activeTab, onTabChange }: Props) {
  const { profile, role } = useAuth()
  const name = profile?.full_name || profile?.email || 'User'
  const initial = name.slice(0, 1).toUpperCase()

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <div className="brand-mark">CL</div>
        <div className="brand-text">
          <div className="brand-name">CredLock</div>
          <div className="brand-sub">Technical Support</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {GROUPS.map((g) => {
          const items = NAV.filter((n) => n.group === g.id)
          return (
            <div className="nav-group" key={g.id}>
              <div className="nav-group-title">{g.title}</div>
              {items.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  className={`nav-item ${activeTab === item.tab ? 'on' : ''}`}
                  onClick={() => onTabChange(item.tab)}
                  title={item.label}
                >
                  <span className="nav-ico" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <div className="avatar">{initial}</div>
          <div className="sidebar-user-meta">
            <div className="sidebar-user-name">{name}</div>
            <div className="sidebar-user-role">{role}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
