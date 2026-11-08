import { useCallback, type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DEVICE_OP_TYPES, KAV_CATS } from '../lib/constants'
import { fmtDate } from '../lib/sla'
import { Modal } from '../components/ui/Modal'

interface Row {
  id: string
  title?: string
  status?: string
  device_type?: string
  created_at?: string
  source?: 'ops' | 'kavro'
  notes?: string
}

export function DeviceOpsPage() {
  const { profile, role } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [mode, setMode] = useState<'ops' | 'kavro'>('ops')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    const [d, k] = await Promise.all([
      supabase.from('device_ops').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('kavro_enrollment').select('*').limit(200),
    ])
    const ops: Row[] = ((d.data as any[]) || []).map((x) => ({
      id: x.id,
      title: x.op_type || x.title || 'Device op',
      status: x.status,
      device_type: x.device_imei,
      created_at: x.created_at,
      source: 'ops' as const,
      notes: x.notes,
    }))
    const kav: Row[] = ((k.data as any[]) || []).map((x) => ({
      id: x.id,
      title: x.issue_category || x.device_model || 'KAVRO',
      status: x.status,
      device_type: x.device_imei,
      created_at: x.created_at || x.date_logged,
      source: 'kavro' as const,
      notes: x.notes || x.description,
    }))
    if (d.error) setMsg(d.error.message)
    setRows([...ops, ...kav])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createOp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    if (mode === 'ops') {
      const { error } = await supabase.from('device_ops').insert({
        op_type: String(fd.get('op_type') || 'Other'),
        title: String(fd.get('op_type') || 'Device op'),
        device_imei: String(fd.get('device_imei') || '') || null,
        status: 'Open',
        notes: String(fd.get('notes') || ''),
        officer: profile?.email || null,
      })
      if (error) setMsg(error.message)
    } else {
      const { error } = await supabase.from('kavro_enrollment').insert({
        issue_category: String(fd.get('issue_category') || 'Other'),
        device_imei: String(fd.get('device_imei') || '') || null,
        status: 'Open',
        notes: String(fd.get('notes') || ''),
        date_logged: new Date().toISOString().slice(0, 10),
      })
      if (error) setMsg(error.message)
    }
    setBusy(false)
    setShowCreate(false)
    await load()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{rows.length} device / KAVRO records</span>
        {canWrite && (
          <button type="button" className="btn" onClick={() => setShowCreate(true)}>
            + Register operation
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
                  <th>Type</th>
                  <th>Item</th>
                  <th>Status</th>
                  <th className="hide-sm">IMEI / Ref</th>
                  <th className="hide-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">No device operations yet</td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="chip b">{r.source === 'kavro' ? 'KAVRO' : 'Ops'}</span></td>
                    <td>{r.title || '—'}</td>
                    <td><span className="chip b">{r.status || '—'}</span></td>
                    <td className="hide-sm mono">{r.device_type || '—'}</td>
                    <td className="hide-sm muted">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showCreate && (
        <Modal title="Register device operation" onClose={() => setShowCreate(false)}
          footer={<><button type="button" className="btn sec" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" form="create-ops" className="btn" disabled={busy}>Save</button></>}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <button type="button" className={`btn ${mode === 'ops' ? '' : 'sec'}`} onClick={() => setMode('ops')}>Device ops</button>
            <button type="button" className={`btn ${mode === 'kavro' ? '' : 'sec'}`} onClick={() => setMode('kavro')}>KAVRO</button>
          </div>
          <form id="create-ops" className="form-grid" onSubmit={createOp}>
            {mode === 'ops' ? (
              <div><label>Operation type</label><select name="op_type" defaultValue="Manual unlock">{DEVICE_OP_TYPES.map((t) => (<option key={t}>{t}</option>))}</select></div>
            ) : (
              <div><label>KAVRO category</label><select name="issue_category" defaultValue="Other">{KAV_CATS.map((t) => (<option key={t}>{t}</option>))}</select></div>
            )}
            <div><label>Device IMEI</label><input name="device_imei" className="mono" /></div>
            <div className="span-2"><label>Notes</label><textarea name="notes" rows={3} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
