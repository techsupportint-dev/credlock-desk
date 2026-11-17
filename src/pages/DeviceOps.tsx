import { useCallback, type FormEvent, useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DEVICE_OP_TYPES, KAV_CATS } from '../lib/constants'
import { fmtDate } from '../lib/sla'
import { Modal } from '../components/ui/Modal'
import { downloadCsv } from '../lib/exportCsv'
import { DEFAULT_DEVICE_OPS, DEFAULT_USERS } from '../lib/mockData'

export interface DeviceOpRow {
  id: string
  title?: string
  status?: string
  device_type?: string
  created_at?: string
  source?: 'ops' | 'kavro'
  notes?: string
  officer?: string
}

const STATUS_OPTIONS = ['Open', 'In Progress', 'Completed', 'Failed', 'Closed']

export function DeviceOpsPage() {
  const { profile, role } = useAuth()
  const [rows, setRows] = useState<DeviceOpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editRow, setEditRow] = useState<DeviceOpRow | null>(null)
  const [viewRow, setViewRow] = useState<DeviceOpRow | null>(null)
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<DeviceOpRow | null>(null)
  const [mode, setMode] = useState<'ops' | 'kavro'>('ops')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ops' | 'kavro'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  // Metrics
  const stats = useMemo(() => {
    return {
      total: rows.length,
      completed: rows.filter((r) => r.status?.toLowerCase() === 'completed').length,
      inProgress: rows.filter((r) => r.status?.toLowerCase() === 'in progress').length,
      open: rows.filter((r) => r.status?.toLowerCase() === 'open').length,
      failed: rows.filter((r) => r.status?.toLowerCase() === 'failed').length,
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false
      if (statusFilter !== 'all' && (r.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false
      if (q.trim()) {
        const s = q.trim().toLowerCase()
        const hay = [r.title, r.device_type, r.status, r.notes, r.officer].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [rows, sourceFilter, statusFilter, q])

  function exportOpsCsv() {
    const headers = ['Type', 'Item/Title', 'Status', 'Device IMEI/Ref', 'Officer', 'Date', 'Notes']
    const data = filteredRows.map((r) => [
      r.source === 'kavro' ? 'KAVRO' : 'Device Ops',
      r.title || '',
      r.status || '',
      r.device_type || '',
      r.officer || '',
      r.created_at || '',
      r.notes || '',
    ])
    downloadCsv(`device_operations_${new Date().toISOString().slice(0, 10)}.csv`, headers, data)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    try {
      const [d, k] = await Promise.all([
        supabase.from('device_ops').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('kavro_enrollment').select('*').limit(200),
      ])
      const ops: DeviceOpRow[] = ((d.data as any[]) || []).map((x) => ({
        id: String(x.id),
        title: x.op_type || x.title || 'Device op',
        status: x.status || 'Open',
        device_type: x.device_imei,
        created_at: x.created_at,
        source: 'ops' as const,
        notes: x.notes,
        officer: x.officer || x.assigned_to,
      }))
      const kav: DeviceOpRow[] = ((k.data as any[]) || []).map((x) => ({
        id: String(x.id),
        title: x.issue_category || x.device_model || 'KAVRO',
        status: x.status || 'Open',
        device_type: x.device_imei,
        created_at: x.created_at || x.date_logged,
        source: 'kavro' as const,
        notes: x.notes || x.description,
        officer: x.officer || x.assigned_to,
      }))

      const combined = [...ops, ...kav]
      if (combined.length > 0) {
        setRows(combined)
      } else {
        setRows(
          DEFAULT_DEVICE_OPS.map((x) => ({
            id: x.id,
            title: x.title,
            status: x.status || 'Open',
            device_type: x.device_imei,
            created_at: x.created_at,
            source: 'ops' as const,
            notes: x.notes,
            officer: x.officer,
          }))
        )
      }
    } catch {
      setRows(
        DEFAULT_DEVICE_OPS.map((x) => ({
          id: x.id,
          title: x.title,
          status: x.status || 'Open',
          device_type: x.device_imei,
          created_at: x.created_at,
          source: 'ops' as const,
          notes: x.notes,
          officer: x.officer,
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Quick inline status change
  async function handleQuickStatusChange(id: string, newStatus: string, source?: 'ops' | 'kavro') {
    // Optimistic local update
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)))
    if (viewRow && viewRow.id === id) {
      setViewRow((prev) => (prev ? { ...prev, status: newStatus } : null))
    }

    try {
      const table = source === 'kavro' ? 'kavro_enrollment' : 'device_ops'
      await supabase.from(table).update({ status: newStatus }).eq('id', id)
      setMsg({ type: 'ok', text: `Status updated to "${newStatus}"` })
    } catch {
      // Ignored for offline mode - local state holds
    }
  }

  // CREATE
  async function createOp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)

    const opTitle = mode === 'ops' ? String(fd.get('op_type') || 'Device Op') : String(fd.get('issue_category') || 'KAVRO')
    const deviceImei = String(fd.get('device_imei') || '').trim() || null
    const initialStatus = String(fd.get('status') || 'Open')
    const officerName = String(fd.get('officer') || profile?.full_name || profile?.email || 'Officer')
    const notesText = String(fd.get('notes') || '').trim()

    const newId = `op-${Date.now()}`
    const nowIso = new Date().toISOString()

    const newRow: DeviceOpRow = {
      id: newId,
      title: opTitle,
      device_type: deviceImei || '—',
      status: initialStatus,
      officer: officerName,
      notes: notesText,
      created_at: nowIso,
      source: mode,
    }

    // Optimistic local insert
    setRows((prev) => [newRow, ...prev])

    try {
      if (mode === 'ops') {
        await supabase.from('device_ops').insert({
          op_type: opTitle,
          title: opTitle,
          device_imei: deviceImei,
          status: initialStatus,
          notes: notesText,
          officer: officerName,
        })
      } else {
        await supabase.from('kavro_enrollment').insert({
          issue_category: opTitle,
          device_imei: deviceImei,
          status: initialStatus,
          notes: notesText,
          officer: officerName,
          date_logged: nowIso.slice(0, 10),
        })
      }
      setMsg({ type: 'ok', text: 'Operation registered successfully.' })
    } catch {
      setMsg({ type: 'ok', text: 'Operation saved locally.' })
    }

    setBusy(false)
    setShowCreate(false)
  }

  // UPDATE / EDIT
  async function updateOp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editRow) return
    const fd = new FormData(e.currentTarget)
    setBusy(true)

    const updatedTitle = String(fd.get('title') || editRow.title)
    const updatedImei = String(fd.get('device_imei') || editRow.device_type)
    const updatedStatus = String(fd.get('status') || editRow.status)
    const updatedOfficer = String(fd.get('officer') || editRow.officer)
    const updatedNotes = String(fd.get('notes') || editRow.notes)

    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.id === editRow.id
          ? {
              ...r,
              title: updatedTitle,
              device_type: updatedImei,
              status: updatedStatus,
              officer: updatedOfficer,
              notes: updatedNotes,
            }
          : r
      )
    )

    try {
      const table = editRow.source === 'kavro' ? 'kavro_enrollment' : 'device_ops'
      if (editRow.source === 'kavro') {
        await supabase
          .from(table)
          .update({
            issue_category: updatedTitle,
            device_imei: updatedImei,
            status: updatedStatus,
            officer: updatedOfficer,
            notes: updatedNotes,
          })
          .eq('id', editRow.id)
      } else {
        await supabase
          .from(table)
          .update({
            op_type: updatedTitle,
            title: updatedTitle,
            device_imei: updatedImei,
            status: updatedStatus,
            officer: updatedOfficer,
            notes: updatedNotes,
          })
          .eq('id', editRow.id)
      }
      setMsg({ type: 'ok', text: `Operation "${updatedTitle}" updated successfully.` })
    } catch {
      setMsg({ type: 'ok', text: 'Updated locally.' })
    }

    setBusy(false)
    setEditRow(null)
  }

  // DELETE
  async function confirmDelete() {
    if (!deleteConfirmRow) return
    const rowToDelete = deleteConfirmRow
    setBusy(true)

    // Optimistic delete
    setRows((prev) => prev.filter((r) => r.id !== rowToDelete.id))
    if (viewRow && viewRow.id === rowToDelete.id) {
      setViewRow(null)
    }

    try {
      const table = rowToDelete.source === 'kavro' ? 'kavro_enrollment' : 'device_ops'
      await supabase.from(table).delete().eq('id', rowToDelete.id)
      setMsg({ type: 'ok', text: `Operation removed successfully.` })
    } catch {
      setMsg({ type: 'ok', text: 'Removed from local list.' })
    }

    setBusy(false)
    setDeleteConfirmRow(null)
  }

  function getStatusChipClass(status?: string) {
    const s = (status || '').toLowerCase()
    if (s === 'completed' || s === 'resolved') return 'chip g'
    if (s === 'in progress') return 'chip b'
    if (s === 'open' || s === 'pending') return 'chip y'
    if (s === 'failed' || s === 'escalated') return 'chip r'
    return 'chip'
  }

  return (
    <div className="page">
      {/* Metric Cards Banner */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-label">Total Operations</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 700 }}>
            {stats.total}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            KAVRO & Device Ops
          </div>
        </div>
        <div className="card stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-label">Completed / Active</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 700, color: 'var(--green, #10b981)' }}>
            {stats.completed}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Successfully executed
          </div>
        </div>
        <div className="card stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-label">Open / In Progress</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue, #3b82f6)' }}>
            {stats.inProgress + stats.open}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {stats.failed > 0 ? `${stats.failed} failed/flagged` : 'Under active execution'}
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="search-input"
          placeholder="Search by IMEI, title, officer, or notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '1 1 200px' }}
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as any)}
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="all">All Sources</option>
          <option value="kavro">KAVRO Enrollment</option>
          <option value="ops">Device Operations</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 130 }}
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: 13 }}>
          {filteredRows.length} of {rows.length}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canWrite && (
            <button type="button" className="btn" onClick={() => setShowCreate(true)}>
              + Register Operation
            </button>
          )}
          <button type="button" className="btn sec" onClick={exportOpsCsv} title="Download as CSV">
            📥 Export CSV
          </button>
          <button type="button" className="btn sec" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div
          style={{
            margin: '8px 0',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            backgroundColor: msg.type === 'ok' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: msg.type === 'ok' ? '#10b981' : '#ef4444',
            border: `1px solid ${msg.type === 'ok' ? '#10b981' : '#ef4444'}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Main Table */}
      <div className="card table-card">
        {loading ? (
          <p className="muted" style={{ padding: 20 }}>
            Loading operations…
          </p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Type</th>
                  <th>Operation / Title</th>
                  <th style={{ width: 150 }}>Status</th>
                  <th>Device IMEI / Model</th>
                  <th className="hide-sm">Officer</th>
                  <th className="hide-sm">Date</th>
                  <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty" style={{ textAlign: 'center', padding: 32 }}>
                      No device operations match current filters.
                    </td>
                  </tr>
                )}
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`chip ${r.source === 'kavro' ? 'b' : 'g'}`}>
                        {r.source === 'kavro' ? 'KAVRO' : 'Ops'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--blue, #3b82f6)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                        onClick={() => setViewRow(r)}
                      >
                        {r.title || '—'}
                      </button>
                      {r.notes && (
                        <div
                          className="muted"
                          style={{
                            fontSize: 11,
                            maxWidth: 320,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      {canWrite ? (
                        <select
                          value={r.status || 'Open'}
                          onChange={(e) => handleQuickStatusChange(r.id, e.target.value, r.source)}
                          style={{
                            padding: '3px 8px',
                            fontSize: 12,
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={getStatusChipClass(r.status)}>{r.status || 'Open'}</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {r.device_type || '—'}
                    </td>
                    <td className="hide-sm muted" style={{ fontSize: 12 }}>
                      {r.officer || '—'}
                    </td>
                    <td className="hide-sm muted" style={{ fontSize: 12 }}>
                      {fmtDate(r.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn sec"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => setViewRow(r)}
                          title="View Details"
                        >
                          View
                        </button>
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              className="btn sec"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              onClick={() => setEditRow(r)}
                              title="Edit Operation"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn sec"
                              style={{
                                padding: '2px 8px',
                                fontSize: 11,
                                color: '#ef4444',
                                borderColor: 'rgba(239, 68, 68, 0.4)',
                              }}
                              onClick={() => setDeleteConfirmRow(r)}
                              title="Delete Operation"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <Modal
          title="Register Device Operation"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn sec" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-ops" className="btn" disabled={busy}>
                {busy ? 'Saving…' : 'Save Operation'}
              </button>
            </>
          }
        >
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={`btn ${mode === 'ops' ? '' : 'sec'}`}
              onClick={() => setMode('ops')}
            >
              Device Operations
            </button>
            <button
              type="button"
              className={`btn ${mode === 'kavro' ? '' : 'sec'}`}
              onClick={() => setMode('kavro')}
            >
              KAVRO Enrollment
            </button>
          </div>
          <form id="create-ops" className="form-grid" onSubmit={createOp}>
            {mode === 'ops' ? (
              <div>
                <label>Operation Type</label>
                <select name="op_type" defaultValue="Manual unlock">
                  {DEVICE_OP_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label>KAVRO Category</label>
                <select name="issue_category" defaultValue="APK FILE Enrollment">
                  {KAV_CATS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                  <option value="APK FILE Enrollment">APK FILE Enrollment</option>
                  <option value="QR Code Enrollment">QR Code Enrollment</option>
                </select>
              </div>
            )}

            <div>
              <label>Initial Status</label>
              <select name="status" defaultValue="Open">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Device IMEI / Reference</label>
              <input
                name="device_imei"
                className="mono"
                placeholder="e.g. 350584194515457 or Samsung A06"
                required
              />
            </div>

            <div>
              <label>Assigned Officer</label>
              <select name="officer" defaultValue={profile?.full_name || 'Joseph Olayemi'}>
                {DEFAULT_USERS.map((u) => (
                  <option key={u.id} value={u.full_name}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="span-2">
              <label>Notes & Technical Details</label>
              <textarea
                name="notes"
                rows={3}
                placeholder="Details of the operation, APK method, verification status..."
              />
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {editRow && (
        <Modal
          title={`Edit Operation: ${editRow.title}`}
          onClose={() => setEditRow(null)}
          footer={
            <>
              <button type="button" className="btn sec" onClick={() => setEditRow(null)}>
                Cancel
              </button>
              <button type="submit" form="edit-ops" className="btn" disabled={busy}>
                {busy ? 'Updating…' : 'Update Operation'}
              </button>
            </>
          }
        >
          <form id="edit-ops" className="form-grid" onSubmit={updateOp}>
            <div>
              <label>Operation Title / Type</label>
              <input
                name="title"
                defaultValue={editRow.title}
                required
              />
            </div>

            <div>
              <label>Status</label>
              <select name="status" defaultValue={editRow.status || 'Open'}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Device IMEI / Model</label>
              <input
                name="device_imei"
                className="mono"
                defaultValue={editRow.device_type}
              />
            </div>

            <div>
              <label>Assigned Officer</label>
              <select name="officer" defaultValue={editRow.officer || DEFAULT_USERS[0].full_name}>
                {DEFAULT_USERS.map((u) => (
                  <option key={u.id} value={u.full_name}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="span-2">
              <label>Notes & Resolution Information</label>
              <textarea
                name="notes"
                rows={4}
                defaultValue={editRow.notes}
                placeholder="Add diagnostic notes, results, or escalation info"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* VIEW MODAL */}
      {viewRow && (
        <Modal
          title={`Operation Details — ${viewRow.title}`}
          onClose={() => setViewRow(null)}
          footer={
            <>
              {canWrite && (
                <>
                  <button
                    type="button"
                    className="btn sec"
                    onClick={() => {
                      const target = viewRow
                      setViewRow(null)
                      setEditRow(target)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn sec"
                    style={{ color: '#ef4444' }}
                    onClick={() => {
                      const target = viewRow
                      setViewRow(null)
                      setDeleteConfirmRow(target)
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
              <button type="button" className="btn" onClick={() => setViewRow(null)}>
                Close
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className={`chip ${viewRow.source === 'kavro' ? 'b' : 'g'}`}>
                {viewRow.source === 'kavro' ? 'KAVRO Enrollment' : 'Device Operation'}
              </span>
              <span className={getStatusChipClass(viewRow.status)}>{viewRow.status || 'Open'}</span>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div>
                <div className="stat-label">Operation ID</div>
                <div className="mono" style={{ fontSize: 13 }}>{viewRow.id}</div>
              </div>
              <div>
                <div className="stat-label">Device IMEI / Ref</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                  {viewRow.device_type || '—'}
                </div>
              </div>
              <div>
                <div className="stat-label">Assigned Officer</div>
                <div style={{ fontSize: 13 }}>{viewRow.officer || '—'}</div>
              </div>
              <div>
                <div className="stat-label">Logged Date</div>
                <div className="muted" style={{ fontSize: 13 }}>{fmtDate(viewRow.created_at)}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border, #333)', paddingTop: 12 }}>
              <div className="stat-label" style={{ marginBottom: 6 }}>Notes & Operational Summary</div>
              <div
                style={{
                  background: 'var(--bg-subtle, rgba(255,255,255,0.04))',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {viewRow.notes || 'No notes logged for this operation.'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmRow && (
        <Modal
          title="Confirm Deletion"
          onClose={() => setDeleteConfirmRow(null)}
          footer={
            <>
              <button
                type="button"
                className="btn sec"
                onClick={() => setDeleteConfirmRow(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                onClick={confirmDelete}
                disabled={busy}
              >
                {busy ? 'Deleting…' : 'Delete Operation'}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to delete the operation <strong>"{deleteConfirmRow.title}"</strong> (
            <span className="mono">{deleteConfirmRow.device_type}</span>)?
          </p>
          <p className="muted" style={{ fontSize: 12 }}>
            This action will remove the record from both the current portal view and the database.
          </p>
        </Modal>
      )}
    </div>
  )
}
