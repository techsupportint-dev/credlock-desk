import { useCallback, type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/sla'
import { Modal } from '../components/ui/Modal'
import type { Incident } from '../types'

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low']
const INC_STATUSES = ['Open', 'Investigating', 'Mitigated', 'Resolved', 'Closed']

export function IncidentsPage() {
  const { profile, role } = useAuth()
  const [rows, setRows] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) setMsg(error.message)
    setRows((data as Incident[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createIncident(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    const { error } = await supabase.from('incidents').insert({
      title: String(fd.get('title') || '').trim(),
      severity: String(fd.get('severity') || 'Medium'),
      status: 'Open',
      description: String(fd.get('description') || ''),
      affected_service: String(fd.get('affected_service') || '') || null,
      reported_by: profile?.email || null,
    })
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setShowCreate(false)
    await load()
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from('incidents').update({ status }).eq('id', id)
    if (error) setMsg(error.message)
    else await load()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{rows.length} incidents</span>
        {canWrite && (
          <button type="button" className="btn" onClick={() => setShowCreate(true)}>
            + Log incident
          </button>
        )}
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
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th className="hide-sm">Service</th>
                  <th className="hide-sm">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">No incidents logged</td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => setSelected(r)}>
                    <td>{r.title || '—'}</td>
                    <td><span className={`chip ${r.severity === 'Critical' || r.severity === 'High' ? 'r' : 'y'}`}>{r.severity || '—'}</span></td>
                    <td><span className="chip b">{r.status || '—'}</span></td>
                    <td className="hide-sm">{r.affected_service || '—'}</td>
                    <td className="hide-sm muted">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && (
        <Modal title={selected.title || 'Incident'} onClose={() => setSelected(null)}
          footer={canWrite ? (<><select defaultValue="" onChange={(e) => { if (e.target.value) setStatus(selected.id, e.target.value) }}><option value="">Set status…</option>{INC_STATUSES.map((s) => (<option key={s}>{s}</option>))}</select><button type="button" className="btn sec" onClick={() => setSelected(null)}>Close</button></>) : undefined}>
          <div className="detail-grid">
            <div className="detail-row"><div className="label">Severity</div><div className="value">{selected.severity}</div></div>
            <div className="detail-row"><div className="label">Status</div><div className="value">{selected.status}</div></div>
            <div className="detail-row"><div className="label">Service</div><div className="value">{selected.affected_service || '—'}</div></div>
            <div className="detail-row"><div className="label">Description</div><div className="value">{selected.description || '—'}</div></div>
            <div className="detail-row"><div className="label">Root cause</div><div className="value">{selected.root_cause || '—'}</div></div>
            <div className="detail-row"><div className="label">Reported</div><div className="value">{selected.reported_by || '—'} · {fmtDate(selected.created_at)}</div></div>
          </div>
        </Modal>
      )}
      {showCreate && (
        <Modal title="Log incident" onClose={() => setShowCreate(false)}
          footer={<><button type="button" className="btn sec" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" form="create-incident" className="btn" disabled={busy}>Save</button></>}>
          <form id="create-incident" className="form-grid" onSubmit={createIncident}>
            <div className="span-2"><label>Title *</label><input name="title" required /></div>
            <div><label>Severity</label><select name="severity" defaultValue="Medium">{SEVERITIES.map((s) => (<option key={s}>{s}</option>))}</select></div>
            <div><label>Affected service</label><input name="affected_service" /></div>
            <div className="span-2"><label>Description</label><textarea name="description" rows={4} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
