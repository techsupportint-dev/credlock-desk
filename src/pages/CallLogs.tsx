import { useCallback, useEffect, useState, useMemo, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_CALL_LOGS, DEFAULT_USERS } from '../lib/mockData'
import { downloadCsv } from '../lib/exportCsv'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import type { CallLog } from '../types'

export function CallLogsPage() {
  const { role, profile } = useAuth()
  const [rows, setRows] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [officerFilter, setOfficerFilter] = useState('all')
  const [showLogModal, setShowLogModal] = useState(false)
  const [busy, setBusy] = useState(false)

  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    let fetchedData: CallLog[] = []
    try {
      const { data } = await supabase.from('call_logs').select('*').order('created_at', { ascending: false }).limit(200)
      if (data && data.length > 0) {
        fetchedData = data.map((x: any) => ({
          id: String(x.id),
          call_id: x.call_id || `CALL-${x.id}`,
          interaction_id: x.interaction_id || '—',
          officer_id: x.officer_id,
          officer_name: x.officer_name || x.officer,
          direction: x.direction || 'Incoming',
          caller_number: x.caller_number,
          start_time: x.start_time || x.created_at,
          duration_sec: x.duration_sec,
          answer_status: x.answer_status || 'Answered',
        }))
      }
    } catch {
      // Offline fallback
    }

    if (fetchedData.length > 0) {
      setRows(fetchedData)
    } else {
      setRows(DEFAULT_CALL_LOGS)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    return {
      total: rows.length,
      incoming: rows.filter((r) => r.direction.toLowerCase() === 'incoming').length,
      outgoing: rows.filter((r) => r.direction.toLowerCase() === 'outgoing').length,
      answered: rows.filter((r) => r.answer_status?.toLowerCase() === 'answered').length,
    }
  }, [rows])

  const officers = useMemo(() => {
    const s = new Set<string>()
    rows.forEach((r) => {
      if (r.officer_name) s.add(r.officer_name)
    })
    return Array.from(s)
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (directionFilter !== 'all' && r.direction.toLowerCase() !== directionFilter.toLowerCase()) return false
      if (officerFilter !== 'all' && r.officer_name !== officerFilter) return false
      if (q.trim()) {
        const query = q.trim().toLowerCase()
        const hay = [r.call_id, r.interaction_id, r.caller_number, r.officer_name, r.answer_status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
  }, [rows, directionFilter, officerFilter, q])

  function exportCsv() {
    const headers = ['Call ID', 'Interaction ID', 'Officer', 'Direction', 'Caller Number', 'Start Time', 'Duration (s)', 'Status']
    const data = filteredRows.map((r) => [
      r.call_id,
      r.interaction_id || '',
      r.officer_name || '',
      r.direction,
      r.caller_number || '',
      r.start_time || '',
      String(r.duration_sec || ''),
      r.answer_status || '',
    ])
    downloadCsv(`call_logs_${new Date().toISOString().slice(0, 10)}.csv`, headers, data)
  }

  async function handleLogCall(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)

    const callerNo = String(fd.get('caller_number') || '').trim()
    const dir = String(fd.get('direction') || 'Incoming') as 'Incoming' | 'Outgoing'
    const officerName = String(fd.get('officer') || profile?.full_name || 'Officer')
    const duration = Number(fd.get('duration_sec') || 60)
    const newId = `call-${Date.now()}`
    const callCode = `CALL-${String(rows.length + 1).padStart(4, '0')}`

    const newLog: CallLog = {
      id: newId,
      call_id: callCode,
      interaction_id: `INT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      officer_name: officerName,
      direction: dir,
      caller_number: callerNo,
      start_time: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      duration_sec: duration,
      answer_status: 'Answered',
    }

    setRows((prev) => [newLog, ...prev])

    try {
      await supabase.from('call_logs').insert({
        call_id: callCode,
        caller_number: callerNo,
        direction: dir,
        officer: officerName,
        duration_sec: duration,
        answer_status: 'Answered',
      })
    } catch {
      // offline mode
    }

    setBusy(false)
    setShowLogModal(false)
  }

  return (
    <div className="page">
      {/* KPI Stats */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-label">Total Calls Logged</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 700 }}>
            {stats.total}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            From TechDB Call_Logs
          </div>
        </div>
        <div className="card stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-label">Incoming Support Calls</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue, #3b82f6)' }}>
            {stats.incoming}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Customer inbound queries
          </div>
        </div>
        <div className="card stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-label">Outgoing Follow-ups</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 700, color: 'var(--green, #10b981)' }}>
            {stats.outgoing}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {stats.answered} calls answered
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="search-input"
          placeholder="Search caller number, call ID, officer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '1 1 200px' }}
        />
        <select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="all">All Directions</option>
          <option value="incoming">Incoming</option>
          <option value="outgoing">Outgoing</option>
        </select>
        <select
          value={officerFilter}
          onChange={(e) => setOfficerFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="all">All Officers</option>
          {officers.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: 13 }}>
          {filteredRows.length} of {rows.length}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {canWrite && (
            <button type="button" className="btn" onClick={() => setShowLogModal(true)}>
              + Log Call
            </button>
          )}
          <button type="button" className="btn sec" onClick={exportCsv} title="Download CSV">
            📥 Export CSV
          </button>
          <button type="button" className="btn sec" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card table-card">
        {loading ? (
          <p className="muted" style={{ padding: 20 }}>Loading call records…</p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Call ID</th>
                  <th style={{ width: 130 }}>Interaction</th>
                  <th>Direction</th>
                  <th>Officer</th>
                  <th>Caller / Contact</th>
                  <th className="hide-sm">Start Time</th>
                  <th className="hide-sm">Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty" style={{ textAlign: 'center', padding: 32 }}>
                      No call records match the selected filters.
                    </td>
                  </tr>
                )}
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{r.call_id}</td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{r.interaction_id || '—'}</td>
                    <td>
                      <span className={`chip ${r.direction.toLowerCase() === 'incoming' ? 'b' : 'g'}`}>
                        {r.direction}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{r.officer_name || '—'}</td>
                    <td className="mono" style={{ fontSize: 13 }}>{r.caller_number || '—'}</td>
                    <td className="hide-sm muted" style={{ fontSize: 12 }}>{r.start_time || '—'}</td>
                    <td className="hide-sm muted" style={{ fontSize: 12 }}>
                      {r.duration_sec ? `${r.duration_sec}s` : '—'}
                    </td>
                    <td>
                      <span className="chip g">{r.answer_status || 'Answered'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Call Modal */}
      {showLogModal && (
        <Modal
          title="Log New Support Call"
          onClose={() => setShowLogModal(false)}
          footer={
            <>
              <button type="button" className="btn sec" onClick={() => setShowLogModal(false)}>
                Cancel
              </button>
              <button type="submit" form="log-call-form" className="btn" disabled={busy}>
                {busy ? 'Saving…' : 'Save Call Record'}
              </button>
            </>
          }
        >
          <form id="log-call-form" className="form-grid" onSubmit={handleLogCall}>
            <div>
              <label>Call Direction</label>
              <select name="direction" defaultValue="Incoming">
                <option value="Incoming">Incoming (Customer Called)</option>
                <option value="Outgoing">Outgoing (Officer Called)</option>
              </select>
            </div>
            <div>
              <label>Caller Phone Number</label>
              <input name="caller_number" className="mono" placeholder="e.g. 08023456789" required />
            </div>
            <div>
              <label>Handling Officer</label>
              <select name="officer" defaultValue={profile?.full_name || 'Zainab Sheu'}>
                {DEFAULT_USERS.map((u) => (
                  <option key={u.id} value={u.full_name}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Call Duration (Seconds)</label>
              <input name="duration_sec" type="number" defaultValue={120} min={1} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
