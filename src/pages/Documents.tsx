import { useCallback, type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/sla'
import { Modal } from '../components/ui/Modal'
import type { DocumentRow } from '../types'

export function DocumentsPage() {
  const { profile, role } = useAuth()
  const [rows, setRows] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) {
      setMsg(error.message)
      setRows([])
    } else setRows((data as DocumentRow[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    const { error } = await supabase.from('documents').insert({
      title: String(fd.get('title') || '').trim(),
      doc_type: String(fd.get('doc_type') || 'General'),
      notes: String(fd.get('notes') || ''),
      uploaded_by: profile?.email || null,
    })
    setBusy(false)
    if (error) setMsg(error.message)
    else {
      setShow(false)
      await load()
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">Document & report register</span>
        {canWrite && (
          <button type="button" className="btn" onClick={() => setShow(true)}>
            + Register document
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
                  <th>Type</th>
                  <th className="hide-sm">Uploaded by</th>
                  <th className="hide-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No documents registered
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title || '—'}</td>
                    <td>
                      <span className="chip b">{r.doc_type || '—'}</span>
                    </td>
                    <td className="hide-sm">{r.uploaded_by || '—'}</td>
                    <td className="hide-sm muted">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && (
        <Modal
          title="Register document"
          onClose={() => setShow(false)}
          footer={
            <>
              <button type="button" className="btn sec" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button type="submit" form="create-doc" className="btn" disabled={busy}>
                Save
              </button>
            </>
          }
        >
          <form id="create-doc" className="form-grid" onSubmit={createDoc}>
            <div className="span-2">
              <label>Title *</label>
              <input name="title" required />
            </div>
            <div>
              <label>Type</label>
              <select name="doc_type" defaultValue="Report">
                <option>Report</option>
                <option>Policy</option>
                <option>Playbook</option>
                <option>Evidence</option>
                <option>General</option>
              </select>
            </div>
            <div className="span-2">
              <label>Notes</label>
              <textarea name="notes" rows={3} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
