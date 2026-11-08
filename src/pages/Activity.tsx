import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/sla'

interface Row {
  id: string
  action?: string
  detail?: string
  actor?: string
  created_at?: string
  ticket_id?: string
}

export function ActivityPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let data: any[] | null = null
    let error: any = null
    const a = await supabase.from('system_activity').select('*').order('created_at', { ascending: false }).limit(200)
    if (!a.error && a.data) data = a.data
    else {
      const b = await supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(200)
      data = b.data
      error = b.error
    }
    if (error) setMsg(error.message)
    setRows(
      ((data as any[]) || []).map((x) => ({
        id: x.id,
        action: x.action || x.event_type || x.type,
        detail: x.detail || x.description || x.message,
        actor: x.actor || x.user_email || x.created_by,
        created_at: x.created_at,
        ticket_id: x.ticket_id,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">System activity / audit trail</span>
        <button type="button" className="btn sec" onClick={() => load()}>
          Refresh
        </button>
      </div>
      {msg && <div className="auth-error">{msg}</div>}
      <div className="card table-card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Detail</th>
                  <th className="hide-sm">Actor</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No activity recorded
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{fmtDate(r.created_at)}</td>
                    <td>
                      <span className="chip b">{r.action || '—'}</span>
                    </td>
                    <td>{r.detail || '—'}</td>
                    <td className="hide-sm">{r.actor || '—'}</td>
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
