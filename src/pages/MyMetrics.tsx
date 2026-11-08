import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CLOSED_STATUSES, OPEN_STATUSES } from '../lib/constants'
import { isSlaBreached } from '../lib/sla'
import type { Ticket } from '../types'

export function MyMetricsPage() {
  const { profile } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('tickets')
      .select('*')
      .limit(1000)
      .then(({ data }) => {
        if (!cancelled) {
          setTickets((data as Ticket[]) || [])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const mine = useMemo(() => {
    const email = (profile?.email || '').toLowerCase()
    return tickets.filter(
      (t) => (t.officer || '').toLowerCase() === email || (t.assigned_to && t.assigned_to === profile?.id)
    )
  }, [tickets, profile])

  const stats = useMemo(() => {
    const open = mine.filter((t) => OPEN_STATUSES.has(String(t.status || ''))).length
    const resolved = mine.filter((t) => CLOSED_STATUSES.has(String(t.status || ''))).length
    const breached = mine.filter(isSlaBreached).length
    const rate = mine.length ? Math.round((resolved / mine.length) * 100) : 0
    return { total: mine.length, open, resolved, breached, rate }
  }, [mine])

  if (loading) return <div className="card"><p className="muted">Loading metrics…</p></div>

  return (
    <div className="page">
      <div className="card brand-header">
        <h3 style={{ margin: 0 }}>My performance</h3>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Tickets assigned to {profile?.full_name || profile?.email}
        </p>
      </div>
      <div className="grid g4">
        <div className="card tile kpi">
          <div className="v">{stats.total}</div>
          <div className="l">Assigned to me</div>
        </div>
        <div className="card tile kpi">
          <div className="v">{stats.open}</div>
          <div className="l">Open workload</div>
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
          <div className={`v ${stats.breached ? 'bad' : ''}`}>{stats.breached}</div>
          <div className="l">SLA breached</div>
        </div>
      </div>
    </div>
  )
}
