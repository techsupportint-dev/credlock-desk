import { useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { supabase } from '../lib/supabase'
import type { Ticket, Incident, DeviceOp } from '../types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
)

const OPEN = new Set(['New', 'Assigned', 'In Progress', 'Pending', 'Escalated', 'Reopened', 'OPEN', 'IN_PROGRESS', 'WAITING'])
const CLOSED = new Set(['Resolved', 'Closed', 'RESOLVED', 'CLOSED'])

export function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [ops, setOps] = useState<DeviceOp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [t, i, d] = await Promise.all([
        supabase.from('tickets').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('incidents').select('*').limit(200),
        supabase.from('device_ops').select('*').limit(200),
      ])
      if (cancelled) return
      setTickets((t.data as Ticket[]) || [])
      setIncidents((i.data as Incident[]) || [])
      setOps((d.data as DeviceOp[]) || [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((x) => OPEN.has(String(x.status || ''))).length
    const resolved = tickets.filter((x) => CLOSED.has(String(x.status || ''))).length
    const rate = total ? Math.round((resolved / total) * 100) : 0
    const openInc = incidents.filter((x) => !CLOSED.has(String(x.status || ''))).length
    const opsOpen = ops.filter((x) => !['Resolved', 'Closed', 'Completed'].includes(String(x.status || ''))).length

    const byStatus: Record<string, number> = {}
    tickets.forEach((t) => {
      const s = String(t.status || 'Unknown')
      byStatus[s] = (byStatus[s] || 0) + 1
    })

    const byCat: Record<string, number> = {}
    tickets.forEach((t) => {
      const c = String(t.issue_type || t.category || 'Other')
      byCat[c] = (byCat[c] || 0) + 1
    })

    const days: string[] = []
    const dayCounts: number[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push(key.slice(5))
      dayCounts.push(tickets.filter((t) => (t.created_at || '').startsWith(key)).length)
    }

    return { total, open, resolved, rate, openInc, opsOpen, byStatus, byCat, days, dayCounts }
  }, [tickets, incidents, ops])

  const isDark =
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  const tick = isDark ? '#93a5a3' : '#5d6b6a'
  const grid = isDark ? '#2a3837' : '#dfe5e4'

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Loading dashboard…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card brand-header">
        <h3>CredLock Technical Support — KPI Dashboard</h3>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Live metrics. SLA targets: P1 5m · P2 10m · P3 30m · P4 2h first response.
        </p>
      </div>

      <h4 className="section-label">Ticket performance</h4>
      <div className="grid g4">
        <div className="card tile kpi">
          <div className="v">{stats.total}</div>
          <div className="l">Total tickets</div>
        </div>
        <div className="card tile kpi">
          <div className="v">{stats.open}</div>
          <div className="l">Open / active</div>
        </div>
        <div className="card tile kpi">
          <div className="v ok">{stats.resolved}</div>
          <div className="l">Resolved</div>
        </div>
        <div className="card tile kpi">
          <div className="v ok">{stats.rate}%</div>
          <div className="l">Resolution rate</div>
        </div>
        <div className="card tile kpi">
          <div className="v">{stats.openInc}</div>
          <div className="l">Open incidents</div>
        </div>
        <div className="card tile kpi">
          <div className="v">{stats.opsOpen}</div>
          <div className="l">Device ops open</div>
        </div>
      </div>

      <h4 className="section-label">Analytics</h4>
      <div className="chart-grid">
        <div className="card chart-card">
          <h4>Ticket volume (7 days)</h4>
          <div className="chart-wrap">
            <Line
              data={{
                labels: stats.days,
                datasets: [
                  {
                    label: 'Created',
                    data: stats.dayCounts,
                    borderColor: '#0b6e75',
                    backgroundColor: 'rgba(11,110,117,.15)',
                    fill: true,
                    tension: 0.35,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: tick } } },
                scales: {
                  x: { ticks: { color: tick }, grid: { display: false } },
                  y: { ticks: { color: tick, stepSize: 1 }, grid: { color: grid }, beginAtZero: true },
                },
              }}
            />
          </div>
        </div>
        <div className="card chart-card">
          <h4>Status distribution</h4>
          <div className="chart-wrap">
            <Doughnut
              data={{
                labels: Object.keys(stats.byStatus),
                datasets: [
                  {
                    data: Object.values(stats.byStatus),
                    backgroundColor: ['#0b6e75', '#4fc3cc', '#b26a00', '#b3261e', '#1a7f4b', '#5d6b6a'],
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: tick, boxWidth: 12 } } },
                cutout: '58%',
              }}
            />
          </div>
        </div>
        <div className="card chart-card chart-span">
          <h4>By category</h4>
          <div className="chart-wrap">
            <Bar
              data={{
                labels: Object.keys(stats.byCat).slice(0, 10),
                datasets: [
                  {
                    label: 'Tickets',
                    data: Object.values(stats.byCat).slice(0, 10),
                    backgroundColor: '#0b6e75',
                    borderRadius: 6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: tick, maxRotation: 45 }, grid: { display: false } },
                  y: { ticks: { color: tick }, grid: { color: grid }, beginAtZero: true },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
