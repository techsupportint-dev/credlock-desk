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
    const { data, error } = await supabase.from('recommendations').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) setMsg(error.message)
    setRows((data as Row[]) || [])
    setLoading(false)
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
