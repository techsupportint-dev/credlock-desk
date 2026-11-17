import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { downloadCsv } from '../lib/exportCsv'
import {
  fmtDate,
  isSlaBreached,
  isSlaApproaching,
  priorityMeta,
  ageMinutes,
  normalizeStatus,
} from '../lib/sla'
import { logTicketHistory } from '../lib/ticketHistory'
import {
  STATUSES,
  PRIOS,
  ISSUE_TYPES,
  REQUESTER_TYPES,
  SOURCE_CHANNELS,
  OPEN_STATUSES,
  CLOSED_STATUSES,
} from '../lib/constants'
import { DEFAULT_TICKETS, DEFAULT_USERS } from '../lib/mockData'
import type { Ticket } from '../types'

export function TicketsPage() {
  const { profile, role } = useAuth()
  const [rows, setRows] = useState<Ticket[]>([])
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [slaFilter, setSlaFilter] = useState<'ALL' | 'BREACHED' | 'RISK' | 'HEALTHY'>('ALL')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Officer list for assignment
  const [officers, setOfficers] = useState<{ id: string; email: string; full_name?: string }[]>([])

  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ticketsRes, teamRes] = await Promise.all([
        supabase.from('tickets').select('*').order('created_at', { ascending: false }).limit(400),
        supabase.from('profiles').select('id, email, full_name').limit(100),
      ])

      if (ticketsRes.data && ticketsRes.data.length > 0) {
        setRows(ticketsRes.data as Ticket[])
      } else {
        setRows(DEFAULT_TICKETS)
      }

      if (teamRes.data && teamRes.data.length > 0) {
        setOfficers(teamRes.data)
      } else {
        setOfficers(DEFAULT_USERS.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name })))
      }
    } catch {
      setRows(DEFAULT_TICKETS)
      setOfficers(DEFAULT_USERS.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Load ticket history when a ticket is selected
  useEffect(() => {
    if (!selectedTicket?.id) {
      setHistory([])
      return
    }
    let cancelled = false
    supabase
      .from('ticket_history')
      .select('*')
      .eq('ticket_id', selectedTicket.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) {
          setHistory(data)
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedTicket?.id])

  // SLA and counts summary
  const summary = useMemo(() => {
    const total = rows.length
    const open = rows.filter((t) => OPEN_STATUSES.has(t.status || 'New')).length
    const breached = rows.filter((t) => isSlaBreached(t)).length
    const atRisk = rows.filter((t) => isSlaApproaching(t)).length
    const resolved = rows.filter((t) => CLOSED_STATUSES.has(t.status || '')).length
    return { total, open, breached, atRisk, resolved }
  }, [rows])

  // Filtered tickets
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((t) => {
      // Search
      if (s) {
        const hay = [
          t.ticket_no,
          t.title,
          t.status,
          t.priority,
          t.officer,
          t.category,
          t.issue_type,
          t.customer,
          t.merchant_name,
          t.device_imei,
          t.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(s)) return false
      }

      // Status
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'OPEN') {
          if (!OPEN_STATUSES.has(t.status || 'New')) return false
        } else if (statusFilter === 'CLOSED') {
          if (!CLOSED_STATUSES.has(t.status || '')) return false
        } else if (t.status !== statusFilter) {
          return false
        }
      }

      // Priority
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) {
        return false
      }

      // SLA
      if (slaFilter === 'BREACHED' && !isSlaBreached(t)) return false
      if (slaFilter === 'RISK' && !isSlaApproaching(t)) return false
      if (slaFilter === 'HEALTHY' && (isSlaBreached(t) || isSlaApproaching(t))) return false

      return true
    })
  }, [rows, q, statusFilter, priorityFilter, slaFilter])

  // Create ticket
  async function handleCreateTicket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const fd = new FormData(e.currentTarget)

    const priority = String(fd.get('priority') || 'P3 Normal')
    const category = String(fd.get('category') || 'Customer Support')
    const ticketNo = `T-${Date.now().toString().slice(-6)}`

    const newTicket: Partial<Ticket> = {
      ticket_no: ticketNo,
      title: String(fd.get('title') || '').trim(),
      priority,
      category,
      issue_type: category,
      status: 'New',
      source_channel: String(fd.get('source_channel') || 'Portal'),
      customer: String(fd.get('customer') || '').trim() || null,
      requester_name: String(fd.get('customer') || '').trim() || null,
      requester_contact: String(fd.get('requester_contact') || '').trim() || null,
      requester_type: String(fd.get('requester_type') || 'Customer'),
      device_imei: String(fd.get('device_imei') || '').trim() || null,
      officer: String(fd.get('officer') || profile?.email || '').trim() || null,
      description: String(fd.get('description') || '').trim() || null,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from('tickets').insert(newTicket).select().single()

    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }

    if (data) {
      await logTicketHistory({
        ticketId: data.id,
        changeType: 'created',
        newValue: 'New',
        actorEmail: profile?.email || null,
        actorId: profile?.id || null,
        details: { initial_priority: priority, category },
      })
    }

    setShowCreate(false)
    await load()
  }

  // Update status or resolution
  async function handleUpdateTicket(status: string, resolutionNotes?: string, newOfficer?: string) {
    if (!selectedTicket) return
    setBusy(true)
    setMsg(null)

    const updates: Record<string, any> = { status }
    if (status === 'Resolved' || status === 'Closed') {
      updates.resolved_at = new Date().toISOString()
      if (resolutionNotes) updates.resolution_notes = resolutionNotes
    }
    if (newOfficer !== undefined) {
      updates.officer = newOfficer
    }
    if (!selectedTicket.first_response_at && ['In Progress', 'Assigned', 'Resolved'].includes(status)) {
      updates.first_response_at = new Date().toISOString()
    }

    const { error } = await supabase.from('tickets').update(updates).eq('id', selectedTicket.id)

    if (error) {
      setMsg(error.message)
    } else {
      await logTicketHistory({
        ticketId: selectedTicket.id,
        changeType: status !== selectedTicket.status ? 'status_change' : 'update',
        oldValue: selectedTicket.status,
        newValue: status,
        actorEmail: profile?.email || null,
        actorId: profile?.id || null,
        details: { resolutionNotes, newOfficer },
      })

      // Update local state
      const updated = { ...selectedTicket, ...updates }
      setSelectedTicket(updated)
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    }
    setBusy(false)
  }

  // Export filtered tickets to CSV
  function handleExportCsv() {
    const headers = [
      'Ticket #',
      'Title',
      'Status',
      'Priority',
      'Category',
      'Officer',
      'Customer',
      'Phone',
      'Device IMEI',
      'SLA Status',
      'Created At',
      'Resolved At',
      'Description',
      'Resolution Notes',
    ]

    const csvRows = filtered.map((t) => {
      let slaText = 'Within SLA'
      if (isSlaBreached(t)) slaText = 'BREACHED'
      else if (isSlaApproaching(t)) slaText = 'AT RISK'

      return [
        t.ticket_no || t.id.slice(0, 8),
        t.title || '',
        t.status || 'New',
        t.priority || 'Medium',
        t.category || t.issue_type || '',
        t.officer || '',
        t.customer || t.requester_name || '',
        t.requester_contact || '',
        t.device_imei || '',
        slaText,
        t.created_at || '',
        t.resolved_at || '',
        t.description || '',
        t.resolution_notes || '',
      ]
    })

    downloadCsv(`credlock_tickets_${new Date().toISOString().slice(0, 10)}.csv`, headers, csvRows)
  }

  return (
    <div className="page">
      {/* Metric Tiles / KPI */}
      <div className="grid g4">
        <div
          className="card tile click"
          onClick={() => {
            setStatusFilter('ALL')
            setSlaFilter('ALL')
          }}
          title="Show all tickets"
        >
          <div className="v">{summary.total}</div>
          <div className="l">Total Tickets</div>
        </div>
        <div
          className="card tile click"
          onClick={() => {
            setStatusFilter('OPEN')
            setSlaFilter('ALL')
          }}
          title="Show open tickets"
        >
          <div className="v">{summary.open}</div>
          <div className="l">Open / In Progress</div>
        </div>
        <div
          className="card tile click"
          onClick={() => {
            setSlaFilter('BREACHED')
            setStatusFilter('OPEN')
          }}
          title="Filter SLA breached tickets"
        >
          <div className="v bad">{summary.breached}</div>
          <div className="l">SLA Breached</div>
        </div>
        <div
          className="card tile click"
          onClick={() => {
            setSlaFilter('RISK')
            setStatusFilter('OPEN')
          }}
          title="Filter tickets near SLA breach"
        >
          <div className="v" style={{ color: 'var(--warn)' }}>
            {summary.atRisk}
          </div>
          <div className="l">SLA At Risk (&gt;70%)</div>
        </div>
      </div>

      {/* Main Toolbar & Filters */}
      <div className="card" style={{ padding: 14 }}>
        <div className="toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="search-input"
            placeholder="Search by ticket #, title, IMEI, customer, officer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: '1 1 240px' }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 120 }}
            aria-label="Filter by Status"
          >
            <option value="ALL">Status: All</option>
            <option value="OPEN">Status: Open / Active</option>
            <option value="CLOSED">Status: Resolved / Closed</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 120 }}
            aria-label="Filter by Priority"
          >
            <option value="ALL">Priority: All</option>
            {PRIOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value as any)}
            style={{ width: 'auto', minWidth: 120 }}
            aria-label="Filter by SLA Health"
          >
            <option value="ALL">SLA: All Health</option>
            <option value="BREACHED">⚠️ Breached SLA</option>
            <option value="RISK">⏳ At Risk (&gt;70%)</option>
            <option value="HEALTHY">✅ Within SLA</option>
          </select>

          <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>
            {filtered.length} of {rows.length}
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canWrite && (
              <button
                type="button"
                className="btn"
                onClick={() => setShowCreate(true)}
                style={{ fontWeight: 600 }}
              >
                + New Ticket
              </button>
            )}

            <button
              type="button"
              className="btn sec"
              onClick={handleExportCsv}
              title="Download filtered tickets as CSV"
            >
              📥 CSV Export
            </button>

            <button type="button" className="btn sec" onClick={() => load()} title="Reload data">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {msg && <div className="auth-error">{msg}</div>}

      {/* Tickets Table */}
      <div className="card table-card">
        {loading ? (
          <p className="muted" style={{ padding: 20 }}>
            Loading tickets from Supabase…
          </p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title & Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>SLA Health</th>
                  <th className="hide-sm">Requester / IMEI</th>
                  <th className="hide-sm">Officer</th>
                  <th className="hide-sm">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">
                      No tickets match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((t) => {
                  const breached = isSlaBreached(t)
                  const atRisk = isSlaApproaching(t)
                  const meta = priorityMeta(t.priority)
                  const age = ageMinutes(t)

                  return (
                    <tr
                      key={t.id}
                      className="click"
                      onClick={() => setSelectedTicket(t)}
                      title="Click to view details and history"
                    >
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--acc)' }}>
                        {t.ticket_no || t.id.slice(0, 8)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.title || 'Untitled Ticket'}</div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {t.category || t.issue_type || 'General'}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`chip ${
                            meta.code === 'P1' ? 'r' : meta.code === 'P2' ? 'y' : 'b'
                          }`}
                        >
                          {meta.code} {meta.label}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`chip ${
                            t.status === 'Resolved' || t.status === 'Closed'
                              ? 'g'
                              : t.status === 'Escalated'
                              ? 'r'
                              : 'b'
                          }`}
                        >
                          {t.status || 'New'}
                        </span>
                      </td>
                      <td>
                        {breached ? (
                          <span className="chip r" title={`SLA target: ${meta.minutes}m, age: ${age}m`}>
                            🚨 Breached
                          </span>
                        ) : atRisk ? (
                          <span className="chip y" title={`SLA target: ${meta.minutes}m, age: ${age}m`}>
                            ⏳ At Risk
                          </span>
                        ) : (
                          <span className="chip g">✅ Within SLA</span>
                        )}
                      </td>
                      <td className="hide-sm">
                        <div style={{ fontSize: 12 }}>{t.customer || t.requester_name || '—'}</div>
                        {t.device_imei && (
                          <div className="mono muted" style={{ fontSize: 11 }}>
                            IMEI: {t.device_imei}
                          </div>
                        )}
                      </td>
                      <td className="hide-sm" style={{ fontSize: 12 }}>
                        {t.officer || <span className="muted">Unassigned</span>}
                      </td>
                      <td className="hide-sm muted" style={{ fontSize: 12 }}>
                        {fmtDate(t.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreate && (
        <Modal title="Create New Ticket" onClose={() => setShowCreate(false)} wide>
          <form onSubmit={handleCreateTicket} className="form-stack">
            <div className="form-grid">
              <div className="span-2">
                <label>Ticket Subject / Title *</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Device enrollment error on Tecno Spark 20"
                />
              </div>

              <div>
                <label>Priority (with SLA)</label>
                <select name="priority" defaultValue="P3 Normal">
                  {PRIOS.map((p) => {
                    const m = priorityMeta(p)
                    return (
                      <option key={p} value={p}>
                        {p} ({m.minutes}m SLA)
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label>Category / Issue Type</label>
                <select name="category" defaultValue="Customer Support">
                  {ISSUE_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Requester Type</label>
                <select name="requester_type" defaultValue="Customer">
                  {REQUESTER_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Source Channel</label>
                <select name="source_channel" defaultValue="Portal">
                  {SOURCE_CHANNELS.map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Customer / Requester Name</label>
                <input name="customer" placeholder="Full name or company" />
              </div>

              <div>
                <label>Contact Phone / Email</label>
                <input name="requester_contact" placeholder="+234 ... or email" />
              </div>

              <div>
                <label>Device IMEI (if applicable)</label>
                <input name="device_imei" placeholder="15-digit IMEI number" />
              </div>

              <div>
                <label>Assign To Officer</label>
                <select name="officer" defaultValue={profile?.email || ''}>
                  <option value="">Unassigned</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.email}>
                      {o.full_name || o.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="span-2">
                <label>Description & Notes</label>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Provide comprehensive details of the customer issue, device state, error codes, and troubleshooting performed..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn sec"
                onClick={() => setShowCreate(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Creating Ticket…' : 'Create Ticket'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Ticket Details & Lifecycle Modal */}
      {selectedTicket && (
        <Modal
          title={`Ticket Details: ${selectedTicket.ticket_no || selectedTicket.id.slice(0, 8)}`}
          onClose={() => setSelectedTicket(null)}
          wide
        >
          <div className="detail-grid">
            {/* Top Badge & SLA Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                paddingBottom: 12,
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem' }}>
                  {selectedTicket.title || 'Untitled Ticket'}
                </h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  Logged {fmtDate(selectedTicket.created_at)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span
                  className={`chip ${
                    selectedTicket.status === 'Resolved' || selectedTicket.status === 'Closed'
                      ? 'g'
                      : selectedTicket.status === 'Escalated'
                      ? 'r'
                      : 'b'
                  }`}
                  style={{ fontSize: 13, padding: '4px 10px' }}
                >
                  Status: {selectedTicket.status || 'New'}
                </span>
                {isSlaBreached(selectedTicket) ? (
                  <span className="chip r" style={{ fontSize: 13, padding: '4px 10px' }}>
                    🚨 SLA Breached
                  </span>
                ) : isSlaApproaching(selectedTicket) ? (
                  <span className="chip y" style={{ fontSize: 13, padding: '4px 10px' }}>
                    ⏳ SLA At Risk
                  </span>
                ) : (
                  <span className="chip g" style={{ fontSize: 13, padding: '4px 10px' }}>
                    ✅ SLA Healthy
                  </span>
                )}
              </div>
            </div>

            {/* Quick Lifecycle Controls */}
            {canWrite && (
              <div
                style={{
                  background: 'var(--acc2)',
                  padding: 12,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)' }}>
                  Update Status:
                </span>
                {['In Progress', 'Pending', 'Escalated', 'Resolved', 'Closed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    className="btn"
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      minHeight: 32,
                      background: selectedTicket.status === st ? 'var(--navy)' : 'var(--panel)',
                      color: selectedTicket.status === st ? '#fff' : 'var(--ink)',
                      border: '1px solid var(--line)',
                    }}
                    disabled={busy || selectedTicket.status === st}
                    onClick={() => {
                      if (st === 'Resolved') {
                        const note = window.prompt('Enter resolution summary / root cause notes:')
                        if (note !== null) handleUpdateTicket(st, note)
                      } else {
                        handleUpdateTicket(st)
                      }
                    }}
                  >
                    {st === 'Resolved' ? '✓ Mark Resolved' : st}
                  </button>
                ))}
              </div>
            )}

            {/* Two Column Ticket Details */}
            <div className="form-grid" style={{ marginTop: 8 }}>
              <div className="detail-row">
                <span className="label">Priority</span>
                <span>
                  <strong style={{ color: 'var(--ink)' }}>
                    {selectedTicket.priority || 'P3 Normal'}
                  </strong>{' '}
                  ({priorityMeta(selectedTicket.priority).minutes} min SLA target)
                </span>
              </div>

              <div className="detail-row">
                <span className="label">Category / Issue</span>
                <span>{selectedTicket.category || selectedTicket.issue_type || 'General'}</span>
              </div>

              <div className="detail-row">
                <span className="label">Assigned Officer</span>
                <span>{selectedTicket.officer || <em className="muted">Unassigned</em>}</span>
              </div>

              <div className="detail-row">
                <span className="label">Device IMEI</span>
                <span className="mono">{selectedTicket.device_imei || '—'}</span>
              </div>

              <div className="detail-row">
                <span className="label">Customer / Requester</span>
                <span>{selectedTicket.customer || selectedTicket.requester_name || '—'}</span>
              </div>

              <div className="detail-row">
                <span className="label">Contact Info</span>
                <span>{selectedTicket.requester_contact || '—'}</span>
              </div>

              <div className="detail-row">
                <span className="label">First Response At</span>
                <span>{fmtDate(selectedTicket.first_response_at)}</span>
              </div>

              <div className="detail-row">
                <span className="label">Resolved At</span>
                <span>{fmtDate(selectedTicket.resolved_at)}</span>
              </div>

              <div className="span-2" style={{ marginTop: 8 }}>
                <span className="label" style={{ fontWeight: 600 }}>
                  Issue Description:
                </span>
                <div
                  style={{
                    background: 'var(--bg)',
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {selectedTicket.description || 'No detailed description provided.'}
                </div>
              </div>

              {selectedTicket.resolution_notes && (
                <div className="span-2">
                  <span className="label" style={{ fontWeight: 600, color: 'var(--ok)' }}>
                    Resolution Notes:
                  </span>
                  <div
                    style={{
                      background: 'rgba(26, 127, 75, 0.08)',
                      border: '1px solid rgba(26, 127, 75, 0.2)',
                      padding: 12,
                      borderRadius: 8,
                      marginTop: 4,
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                    }}
                  >
                    {selectedTicket.resolution_notes}
                  </div>
                </div>
              )}
            </div>

            {/* Ticket Activity / Change History Timeline */}
            <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--mute)' }}>
                Activity & Audit History
              </h4>
              {history.length === 0 ? (
                <p className="muted" style={{ fontSize: 12 }}>
                  No historical changes logged for this ticket yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        fontSize: 12,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--bg)',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <strong>{h.change_type}</strong>:{' '}
                        {h.old_value ? `Changed from "${h.old_value}" to ` : ''}
                        <span style={{ color: 'var(--acc)', fontWeight: 600 }}>"{h.new_value}"</span>
                        {h.actor_email && <span className="muted"> by {h.actor_email}</span>}
                      </div>
                      <span className="muted mono">{fmtDate(h.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
