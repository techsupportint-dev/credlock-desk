import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { TabId } from '../../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface Props {
  activeTab: TabId
  onTabChange: (t: TabId) => void
  title: string
  children: ReactNode
}

export function AppShell({ activeTab, onTabChange, title, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('credlock-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('credlock-theme', theme)
  }, [theme])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 960) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const toggleMenu = () => {
    if (window.innerWidth <= 960) setSidebarOpen((v) => !v)
    else setCollapsed((v) => !v)
  }

  const shellClass = [
    'app-shell',
    collapsed ? 'sidebar-collapsed' : '',
    sidebarOpen ? 'sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(t) => {
          onTabChange(t)
          setSidebarOpen(false)
        }}
      />
      <div className="shell-main">
        <Topbar
          title={title}
          onMenuClick={toggleMenu}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
