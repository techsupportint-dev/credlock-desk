import { useState, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { TicketsPage } from './pages/Tickets'
import { OfficersPage } from './pages/Officers'
import { IncidentsPage } from './pages/Incidents'
import { DeviceOpsPage } from './pages/DeviceOps'
import { ReportsPage } from './pages/Reports'
import { DocumentsPage } from './pages/Documents'
import { MyMetricsPage } from './pages/MyMetrics'
import { ActivityPage } from './pages/Activity'
import { DailyReportPage } from './pages/DailyReport'
import { DepartmentsPage } from './pages/Departments'
import { PlaybooksPage } from './pages/Playbooks'
import { RecommendationsPage } from './pages/Recommendations'
import type { TabId } from './types'

function Boot() {
  const { session, loading, profile } = useAuth()
  const [tab, setTab] = useState<TabId>('dashboard')

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading CredLock Technical Support…</p>
      </div>
    )
  }

  if (!session) return <LoginPage />

  if (profile?.account_status === 'Suspended' || profile?.account_status === 'Inactive') {
    return (
      <div className="login-screen">
        <div className="login-panel card">
          <h2>Account {profile.account_status}</h2>
          <p>Contact a Super Admin for access.</p>
        </div>
      </div>
    )
  }

  const titles: Record<TabId, string> = {
    dashboard: 'Dashboard / KPI',
    tickets: 'Tickets & requests',
    officers: 'Officer management',
    incidents: 'Incident management',
    deviceops: 'Device operations',
    kavro: 'KAVRO / enrollment',
    documents: 'Documents & uploads',
    reports: 'Management reports',
    team: 'Team directory',
    daily: 'Daily report',
    metrics: 'My metrics',
    activity: 'Activity log',
    departments: 'Departments',
    playbooks: 'Playbooks',
    recommendations: 'Recommendations',
  }

  let body: ReactNode = <DashboardPage />
  if (tab === 'tickets') body = <TicketsPage />
  else if (tab === 'officers') body = <OfficersPage />
  else if (tab === 'incidents') body = <IncidentsPage />
  else if (tab === 'deviceops' || tab === 'kavro') body = <DeviceOpsPage />
  else if (tab === 'documents') body = <DocumentsPage />
  else if (tab === 'reports') body = <ReportsPage />
  else if (tab === 'team') body = <OfficersPage teamMode />
  else if (tab === 'metrics') body = <MyMetricsPage />
  else if (tab === 'daily') body = <DailyReportPage />
  else if (tab === 'activity') body = <ActivityPage />
  else if (tab === 'departments') body = <DepartmentsPage />
  else if (tab === 'playbooks') body = <PlaybooksPage />
  else if (tab === 'recommendations') body = <RecommendationsPage />

  return (
    <AppShell activeTab={tab} onTabChange={setTab} title={titles[tab] || 'CredLock'}>
      {body}
    </AppShell>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Boot />
    </AuthProvider>
  )
}
