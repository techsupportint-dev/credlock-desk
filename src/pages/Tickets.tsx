import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Ticket } from '../types'

export function TicketsPage() {
  const [rows, setRows] = useState<Ticket[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        if (!cancelled) {
          setRows((data as Ticket[]) || [])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((t) =>
      [t.ticket_no, t.title, t.status, t.priority, t.officer, t.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    )
  }, [rows, q])

  return (
    <div className="page">
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search tickets…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="muted">{filtered.length} shown</span>
      </div>
      <div className="card table-card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th className="hide-sm">Officer</th>
                  <th className="hide-sm">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No tickets found
                    </td>
                  </tr>
                )}
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.ticket_no || t.id.slice(0, 8)}</td>
                    <td>{t.title || '—'}</td>
                    <td>
                      <span className="chip b">{t.status || '—'}</span>
                    </td>
                    <td>{t.priority || '—'}</td>
                    <td className="hide-sm">{t.officer || '—'}</td>
                    <td className="hide-sm muted">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
