import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CLOSED_STATUSES, OPEN_STATUSES } from '../lib/constants'
import type { Ticket } from '../types'

interface OfficerRow {
  id: string
  email?: string
  full_name?: string
  name?: string
  role?: string
  account_status?: string
  staff_id?: string
  phone?: string
  designation?: string
}

export function OfficersPage({ teamMode }: { teamMode?: boolean }) {
  const [rows, setRows] = useState<OfficerRow[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [profiles, team, tix] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, role, account_status, staff_id, phone, designation').limit(300),
        supabase.from('team').select('id, email, name, role').limit(200),
        supabase.from('tickets').select('id, officer, assigned_to, status').limit(1000),
      ])
      if (cancelled) return
      if (profiles.data?.length) setRows(profiles.data as OfficerRow[])
      else setRows((team.data as OfficerRow[]) || [])
      setTickets((tix.data as Ticket[]) || [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const metrics = useMemo(() => {
    const map: Record<string, { assigned: number; open: number; resolved: number }> = {}
    tickets.forEach((t) => {
      const key = (t.officer || '').toLowerCase()
      if (!key) return
      if (!map[key]) map[key] = { assigned: 0, open: 0, resolved: 0 }
      map[key].assigned++
      if (OPEN_STATUSES.has(String(t.status || ''))) map[key].open++
      if (CLOSED_STATUSES.has(String(t.status || ''))) map[key].resolved++
    })
    return map
  }, [tickets])

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return [r.full_name, r.name, r.email, r.role, r.staff_id].filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
  })

  return (
    <div className="page">
      <div className="card brand-header">
        <h3 style={{ margin: 0 }}>{teamMode ? 'Team directory' : 'Officer management'}</h3>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Profiles, roles and live workload from tickets
        </p>
      </div>
      <div className="toolbar">
        <input className="search-input" placeholder="Search officers…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{filtered.length} records</span>
      </div>
      <div className="card table-card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Assigned</th>
                  <th>Open</th>
                  <th>Resolved</th>
                  <th className="hide-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      No officers found
                    </td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const m = metrics[(r.email || '').toLowerCase()] || { assigned: 0, open: 0, resolved: 0 }
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.full_name || r.name || '—'}</strong>
                        {r.designation && <div className="muted">{r.designation}</div>}
                      </td>
                      <td>{r.email || '—'}</td>
                      <td>
                        <span className="chip b">{r.role || '—'}</span>
                      </td>
                      <td className="mono">{m.assigned}</td>
                      <td className="mono">{m.open}</td>
                      <td className="mono">{m.resolved}</td>
                      <td className="hide-sm">{r.account_status || 'Active'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
