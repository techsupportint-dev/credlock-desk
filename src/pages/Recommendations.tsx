import { useCallback, type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'

interface Row {
  id: string
  title?: string
  body?: string
  source?: string
  status?: string
  priority?: string
  due_date?: string
  created_at?: string
}

const STATUSES = ['Open', 'In Progress', 'Completed', 'Closed']

const DEFAULT_RECOMMENDATIONS: Row[] = [
  {
    id: 'rec-1',
    title: 'FDX Exception Management — Same-Day Manual Responses',
    body: 'Handle legacy post-payment locks with same-day manual responses while FDX engine updates are externally managed. Measure: paid-but-locked complaints trend down week over week.',
    source: 'Technical Support + Engineering',
    status: 'In Progress',
    priority: 'High',
    due_date: '2026-11-30',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'rec-2',
    title: 'Confirm FDX Root Cause of Post-Payment Lock Exceptions',
    body: 'Confirm FDX root cause of post-payment lock exceptions with Engineering. Establish documented escalation path and telemetry hooks.',
    source: 'Technical Support + Engineering',
    status: 'Open',
    priority: 'High',
    due_date: '2026-12-05',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'rec-3',
    title: 'Enrollment Monitoring by Device Model & APK Fallback',
    body: 'Log enrollment issues by device model and track residual APK installer failures so QR/APK regressions on new Samsung and Itel models are caught early.',
    source: 'Technical Support',
    status: 'Open',
    priority: 'Medium',
    due_date: '2026-12-15',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'rec-4',
    title: 'Correct Lobi AI Aging Calculation & Overdue Algorithm',
    body: 'Correct Lobi AI aging calculation linked to 16 aging tickets. Run weekly aging reviews and trigger automated escalation at the SLA threshold.',
    source: 'Technical Support + Engineering',
    status: 'In Progress',
    priority: 'Critical',
    due_date: '2026-11-20',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'rec-5',
    title: 'Redistribute Officer Ticket Workloads (85% Concentration)',
    body: '85% of ticket volume currently sits with three officers. Review individual allocations, introduce automated round-robin routing, and balance shift schedules.',
    source: 'Technical Support Leadership',
    status: 'Open',
    priority: 'High',
    due_date: '2026-11-25',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'rec-6',
    title: 'KAVRO Manager App Uninstallation Real-Time Alerts',
    body: 'Add real-time alerts to the KAVRO engine capturing reason, device details and timestamp, so every uninstallation is detected, explained and traceable.',
    source: 'Engineering + Support Review',
    status: 'Open',
    priority: 'Medium',
    due_date: '2026-12-10',
    created_at: '2026-11-01T08:00:00.000Z',
  },
]

export function RecommendationsPage() {
  const { profile, role } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) setMsg(error.message)
      setRows(data && data.length > 0 ? (data as Row[]) : DEFAULT_RECOMMENDATIONS)
    } catch {
      setRows(DEFAULT_RECOMMENDATIONS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    const { error } = await supabase.from('recommendations').insert({
      title: String(fd.get('title') || '').trim(),
      body: String(fd.get('body') || '') || null,
      source: String(fd.get('source') || 'Team Lead'),
      status: 'Open',
      priority: String(fd.get('priority') || 'Medium'),
      due_date: String(fd.get('due_date') || '') || null,
      created_by: profile?.id || null,
    })
    setBusy(false)
    if (error) setMsg(error.message)
    else {
      setShow(false)
      await load()
    }
  }

  async function setStatus(id: string, status: string) {
    const patch: Record<string, unknown> = { status }
    if (status === 'Completed' || status === 'Closed') patch.completed_at = new Date().toISOString()
    const { error } = await supabase.from('recommendations').update(patch).eq('id', id)
    if (error) setMsg(error.message)
    else await load()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{rows.length} recommendations</span>
        {canWrite && <button type="button" className="btn" onClick={() => setShow(true)}>+ Add recommendation</button>}
        <button type="button" className="btn sec" onClick={() => load()}>Refresh</button>
      </div>
      {msg && <div className="auth-error">{msg}</div>}
      <div className="card table-card">
        {loading ? <p className="muted">Loading…</p> : (
          <div className="tw">
            <table>
              <thead><tr><th>Title</th><th>Status</th><th>Priority</th><th className="hide-sm">Source</th><th className="hide-sm">Due</th><th></th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="empty">No recommendations</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.title}</strong>{r.body && <div className="muted">{r.body.slice(0, 100)}</div>}</td>
                    <td><span className="chip b">{r.status}</span></td>
                    <td>{r.priority || '—'}</td>
                    <td className="hide-sm">{r.source || '—'}</td>
                    <td className="hide-sm">{r.due_date || '—'}</td>
                    <td>{canWrite && (
                      <select defaultValue="" onChange={(e) => { if (e.target.value) setStatus(r.id, e.target.value) }}>
                        <option value="">Status…</option>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && (
        <Modal title="New recommendation" onClose={() => setShow(false)}
          footer={<><button type="button" className="btn sec" onClick={() => setShow(false)}>Cancel</button><button type="submit" form="rec-form" className="btn" disabled={busy}>Save</button></>}>
          <form id="rec-form" className="form-grid" onSubmit={create}>
            <div className="span-2"><label>Title *</label><input name="title" required /></div>
            <div><label>Source</label><select name="source" defaultValue="Team Lead"><option>Team Lead</option><option>Management</option><option>Audit</option></select></div>
            <div><label>Priority</label><select name="priority" defaultValue="Medium"><option>High</option><option>Medium</option><option>Low</option></select></div>
            <div><label>Due date</label><input name="due_date" type="date" /></div>
            <div className="span-2"><label>Details</label><textarea name="body" rows={4} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
