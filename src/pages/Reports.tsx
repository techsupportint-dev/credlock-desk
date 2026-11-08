import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CLOSED_STATUSES, OPEN_STATUSES } from '../lib/constants'
import { fmtDate, isSlaBreached } from '../lib/sla'
import type { Ticket, Incident, DeviceOp } from '../types'

export function ReportsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [ops, setOps] = useState<DeviceOp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('tickets').select('*').limit(1000),
      supabase.from('incidents').select('*').limit(300),
      supabase.from('device_ops').select('*').limit(300),
    ]).then(([t, i, d]) => {
      if (cancelled) return
      setTickets((t.data as Ticket[]) || [])
      setIncidents((i.data as Incident[]) || [])
      setOps((d.data as DeviceOp[]) || [])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const p = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((x) => OPEN_STATUSES.has(String(x.status || ''))).length
    const resolved = tickets.filter((x) => CLOSED_STATUSES.has(String(x.status || ''))).length
    const rate = total ? Math.round((resolved / total) * 100) : 0
    const breached = tickets.filter(isSlaBreached).length
    const escalated = tickets.filter((x) => x.escalated || String(x.status) === 'Escalated').length
    const openInc = incidents.filter((x) => !CLOSED_STATUSES.has(String(x.status || ''))).length
    const byCat: Record<string, number> = {}
    tickets.forEach((t) => {
      const c = String(t.issue_type || t.category || 'Other')
      byCat[c] = (byCat[c] || 0) + 1
    })
    return { total, open, resolved, rate, breached, escalated, openInc, byCat, ops: ops.length }
  }, [tickets, incidents, ops])

  if (loading) return <div className="card"><p className="muted">Loading report data…</p></div>

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">Management report — figures from live system records only</span>
        <button type="button" className="btn" onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>

      <div className="card report-doc" id="mgmt-report">
        <div className="card brand-header" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>CredLock Technical Support — Management Report</h3>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Generated {fmtDate(new Date().toISOString())}
          </p>
        </div>

        <h4>1. Executive summary</h4>
        <p>
          {p.total} tickets in system · {p.resolved} resolved ({p.rate}%) · {p.open} open · {p.breached} SLA
          breaches · {p.escalated} escalated · {p.openInc} open incidents · {p.ops} device operations logged.
        </p>

        <h4>2. Ticket volume and resolution</h4>
        <div className="grid g4" style={{ marginBottom: 12 }}>
          <div className="card tile kpi"><div className="v">{p.total}</div><div className="l">Total</div></div>
          <div className="card tile kpi"><div className="v">{p.open}</div><div className="l">Open</div></div>
          <div className="card tile kpi"><div className="v ok">{p.resolved}</div><div className="l">Resolved</div></div>
          <div className="card tile kpi"><div className="v ok">{p.rate}%</div><div className="l">Rate</div></div>
        </div>

        <h4>3. SLA performance</h4>
        <p>
          First-response targets: P1 5 min · P2 10 min · P3 30 min · P4 2 hours. Current breaches (open tickets
          past target without first response): <strong>{p.breached}</strong>. Escalations: {p.escalated}.
        </p>

        <h4>4. Category breakdown</h4>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(p.byCat)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="mono">{v}</td>
                  </tr>
                ))}
              {Object.keys(p.byCat).length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    No ticket data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h4>5. Incidents</h4>
        <p>Open incidents: {p.openInc}. Total logged: {incidents.length}.</p>
        <ul className="report-structure">
          {incidents.slice(0, 10).map((i) => (
            <li key={i.id}>
              [{i.severity || '—'}] {i.title || 'Untitled'} — {i.status || '—'}
            </li>
          ))}
        </ul>

        <h4>6. Recommendations</h4>
        <ol className="report-structure">
          <li>Clear SLA breaches with first-response acknowledgement before further work.</li>
          <li>Review escalated tickets with Team Lead daily.</li>
          <li>Balance officer workload using Officers tab metrics.</li>
          <li>Log all device unlock/removal cases in Device Ops for audit.</li>
        </ol>

        <p className="muted" style={{ marginTop: 24 }}>
          This report contains only data returned by the system. No metrics are invented.
        </p>
      </div>
    </div>
  )
}
