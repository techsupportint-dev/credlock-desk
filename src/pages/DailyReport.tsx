import { useCallback, type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/sla'

interface Row {
  id: string
  report_date?: string
  summary?: string
  tickets_handled?: number
  notes?: string
  officer_email?: string
  created_at?: string
}

export function DailyReportPage() {
  const { profile, role } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(100)
    if (error) setMsg(error.message)
    setRows((data as Row[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    const { error } = await supabase.from('daily_reports').insert({
      report_date: String(fd.get('report_date') || new Date().toISOString().slice(0, 10)),
      summary: String(fd.get('summary') || '').trim(),
      tickets_handled: Number(fd.get('tickets_handled') || 0),
      notes: String(fd.get('notes') || ''),
      officer_email: profile?.email || null,
    })
    setBusy(false)
    if (error) setMsg(error.message)
    else {
      ;(e.target as HTMLFormElement).reset()
      await load()
    }
  }

  return (
    <div className="page">
      <div className="card brand-header">
        <h3 style={{ margin: 0 }}>Daily report</h3>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Officers log end-of-day summary for Team Lead review
        </p>
      </div>

      {canWrite && (
        <div className="card">
          <form className="form-grid" onSubmit={submit}>
            <div>
              <label>Date</label>
              <input name="report_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div>
              <label>Tickets handled</label>
              <input name="tickets_handled" type="number" min={0} defaultValue={0} />
            </div>
            <div className="span-2">
              <label>Summary *</label>
              <textarea name="summary" rows={3} required placeholder="What was completed today…" />
            </div>
            <div className="span-2">
              <label>Notes / blockers</label>
              <textarea name="notes" rows={2} />
            </div>
            <div className="span-2">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Submit daily report'}
              </button>
            </div>
          </form>
          {msg && <div className="auth-error" style={{ marginTop: 12 }}>{msg}</div>}
        </div>
      )}

      <div className="card table-card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Officer</th>
                  <th>Handled</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No daily reports yet
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.report_date || fmtDate(r.created_at)}</td>
                    <td>{r.officer_email || '—'}</td>
                    <td className="mono">{r.tickets_handled ?? '—'}</td>
                    <td>
                      {r.summary || '—'}
                      {r.notes && <div className="muted">{r.notes}</div>}
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
