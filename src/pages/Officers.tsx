import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CLOSED_STATUSES, OPEN_STATUSES } from '../lib/constants'
import { DEFAULT_USERS, DEFAULT_TICKETS, type UserAccount } from '../lib/mockData'
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
  department?: string
  passcode?: string
}

export function OfficersPage({ teamMode }: { teamMode?: boolean }) {
  const [rows, setRows] = useState<OfficerRow[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [viewMode, setViewMode] = useState<'workload' | 'credentials'>('workload')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [profiles, team, tix] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, full_name, role, account_status, staff_id, phone, designation')
            .limit(300),
          supabase.from('team').select('id, email, name, role').limit(200),
          supabase.from('tickets').select('id, officer, assigned_to, status').limit(1000),
        ])
        if (cancelled) return

        let finalRows: OfficerRow[] = []
        if (profiles.data && profiles.data.length > 0) {
          finalRows = profiles.data as OfficerRow[]
        } else if (team.data && team.data.length > 0) {
          finalRows = team.data as OfficerRow[]
        } else {
          finalRows = DEFAULT_USERS as OfficerRow[]
        }

        // Attach default passcodes if missing
        finalRows = finalRows.map((r) => {
          const match = DEFAULT_USERS.find(
            (u) => u.email.toLowerCase() === (r.email || '').toLowerCase()
          )
          return {
            ...r,
            passcode: r.passcode || match?.passcode || 'CredLock@2026',
            department: r.department || match?.department || 'Technical Support',
            staff_id: r.staff_id || match?.staff_id,
            phone: r.phone || match?.phone,
            designation: r.designation || match?.designation,
          }
        })

        setRows(finalRows)
        setTickets(tix.data && tix.data.length > 0 ? (tix.data as Ticket[]) : DEFAULT_TICKETS)
      } catch {
        setRows(DEFAULT_USERS as OfficerRow[])
        setTickets(DEFAULT_TICKETS)
      } finally {
        if (!cancelled) setLoading(false)
      }
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
    return [r.full_name, r.name, r.email, r.role, r.staff_id, r.department, r.designation]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(s))
  })

  function copyCredentials(r: OfficerRow) {
    const text = `Email: ${r.email}\nPasscode: ${r.passcode || 'CredLock@2026'}\nRole: ${r.role}`
    navigator.clipboard.writeText(text)
    setCopiedId(r.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  return (
    <div className="page">
      <div className="card brand-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>{teamMode ? 'Team Directory' : 'Officer & User Management'}</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Staff profiles, roles, login passcodes and live ticket workload
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setViewMode(viewMode === 'workload' ? 'credentials' : 'workload')}
              style={{
                background: viewMode === 'credentials' ? '#fff' : 'rgba(255,255,255,0.2)',
                color: viewMode === 'credentials' ? 'var(--navy)' : '#fff',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {viewMode === 'workload' ? '🔑 View Login Passcodes' : '📊 View Workload Metrics'}
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <input
          className="search-input"
          placeholder="Search officers by name, email, role, or staff ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '1 1 240px' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {filtered.length} users registered
          </span>
        </div>
      </div>

      <div className="card table-card">
        {loading ? (
          <p className="muted" style={{ padding: 20 }}>
            Loading users from database…
          </p>
        ) : viewMode === 'credentials' ? (
          /* Credentials & Passcodes Table */
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Login Email</th>
                  <th>Role</th>
                  <th>Default Passcode</th>
                  <th>Staff ID</th>
                  <th className="hide-sm">Department</th>
                  <th className="hide-sm">Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const roleColor =
                    r.role === 'Super Admin'
                      ? 'r'
                      : r.role === 'Team Lead'
                      ? 'y'
                      : r.role === 'Officer'
                      ? 'b'
                      : 'g'

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.full_name || r.name || '—'}</strong>
                        {r.designation && <div className="muted" style={{ fontSize: 11 }}>{r.designation}</div>}
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--acc)' }}>
                        {r.email || '—'}
                      </td>
                      <td>
                        <span className={`chip ${roleColor}`}>{r.role || 'Officer'}</span>
                      </td>
                      <td>
                        <code
                          className="mono"
                          style={{
                            background: 'var(--acc2)',
                            color: 'var(--acc)',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {r.passcode || 'CredLock@2026'}
                        </code>
                      </td>
                      <td className="mono muted" style={{ fontSize: 12 }}>
                        {r.staff_id || '—'}
                      </td>
                      <td className="hide-sm" style={{ fontSize: 12 }}>
                        {r.department || 'Technical Support'}
                      </td>
                      <td className="hide-sm muted" style={{ fontSize: 12 }}>
                        {r.phone || '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn sec"
                          onClick={() => copyCredentials(r)}
                          style={{ fontSize: 11, padding: '4px 8px', minHeight: 28 }}
                        >
                          {copiedId === r.id ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Workload & Operations Table */
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Name & Designation</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Total Assigned</th>
                  <th>Open Tickets</th>
                  <th>Resolved</th>
                  <th className="hide-sm">Status</th>
                  <th>Login Passcode</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">
                      No officers found
                    </td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const m = metrics[(r.email || '').toLowerCase()] || { assigned: 0, open: 0, resolved: 0 }
                  const roleColor =
                    r.role === 'Super Admin'
                      ? 'r'
                      : r.role === 'Team Lead'
                      ? 'y'
                      : r.role === 'Officer'
                      ? 'b'
                      : 'g'

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.full_name || r.name || '—'}</strong>
                        {r.designation && <div className="muted" style={{ fontSize: 11 }}>{r.designation}</div>}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {r.email || '—'}
                      </td>
                      <td>
                        <span className={`chip ${roleColor}`}>{r.role || '—'}</span>
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>{m.assigned}</td>
                      <td className="mono" style={{ color: m.open > 0 ? 'var(--warn)' : 'inherit', fontWeight: 600 }}>
                        {m.open}
                      </td>
                      <td className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>{m.resolved}</td>
                      <td className="hide-sm">
                        <span className="chip g">{r.account_status || 'Active'}</span>
                      </td>
                      <td>
                        <code className="mono" style={{ color: 'var(--acc)', fontSize: 11 }}>
                          {r.passcode || 'CredLock@2026'}
                        </code>
                      </td>
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
