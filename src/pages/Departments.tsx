import { useCallback, type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { fmtDate } from '../lib/sla'

interface Dept {
  id: string
  name?: string
  code?: string
  description?: string
  active?: boolean
  created_at?: string
}

export function DepartmentsPage() {
  const { role } = useAuth()
  const [rows, setRows] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [edit, setEdit] = useState<Dept | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const canAdmin = ['Super Admin', 'Team Lead'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('departments').select('*').order('name').limit(200)
    if (error) setMsg(error.message)
    setRows((data as Dept[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    const payload = {
      name: String(fd.get('name') || '').trim(),
      code: String(fd.get('code') || '').trim() || null,
      description: String(fd.get('description') || '').trim() || null,
      active: fd.get('active') === 'on' || fd.get('active') === 'true',
    }
    let error
    if (edit) {
      ;({ error } = await supabase.from('departments').update(payload).eq('id', edit.id))
    } else {
      ;({ error } = await supabase.from('departments').insert(payload))
    }
    setBusy(false)
    if (error) setMsg(error.message)
    else {
      setShow(false)
      setEdit(null)
      await load()
    }
  }

  async function toggleActive(d: Dept) {
    const { error } = await supabase.from('departments').update({ active: !d.active }).eq('id', d.id)
    if (error) setMsg(error.message)
    else await load()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{rows.length} departments</span>
        {canAdmin && (
          <button type="button" className="btn" onClick={() => { setEdit(null); setShow(true) }}>
            + Add department
          </button>
        )}
        <button type="button" className="btn sec" onClick={() => load()}>Refresh</button>
      </div>
      {msg && <div className="auth-error">{msg}</div>}
      <div className="card table-card">
        {loading ? <p className="muted">Loading…</p> : (
          <div className="tw">
            <table>
              <thead>
                <tr><th>Name</th><th>Code</th><th>Status</th><th className="hide-sm">Created</th><th></th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={5} className="empty">No departments</td></tr>}
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.name}</strong>{d.description && <div className="muted">{d.description}</div>}</td>
                    <td className="mono">{d.code || '—'}</td>
                    <td><span className={`chip ${d.active === false ? 'y' : 'g'}`}>{d.active === false ? 'Inactive' : 'Active'}</span></td>
                    <td className="hide-sm muted">{fmtDate(d.created_at)}</td>
                    <td>{canAdmin && (
                      <div className="row-actions">
                        <button type="button" className="btn sec" onClick={() => { setEdit(d); setShow(true) }}>Edit</button>
                        <button type="button" className="btn sec" onClick={() => toggleActive(d)}>{d.active === false ? 'Activate' : 'Deactivate'}</button>
                      </div>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && (
        <Modal title={edit ? 'Edit department' : 'Add department'} onClose={() => { setShow(false); setEdit(null) }}
          footer={<><button type="button" className="btn sec" onClick={() => setShow(false)}>Cancel</button><button type="submit" form="dept-form" className="btn" disabled={busy}>Save</button></>}>
          <form id="dept-form" className="form-grid" onSubmit={save}>
            <div><label>Name *</label><input name="name" required defaultValue={edit?.name || ''} /></div>
            <div><label>Code</label><input name="code" defaultValue={edit?.code || ''} placeholder="e.g. TECH" /></div>
            <div className="span-2"><label>Description</label><textarea name="description" rows={3} defaultValue={edit?.description || ''} /></div>
            <div><label><input name="active" type="checkbox" defaultChecked={edit?.active !== false} /> Active</label></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
