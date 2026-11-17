import { useCallback, useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/sla'
import { DEFAULT_ACTIVITY_LOGS } from '../lib/mockData'
import { downloadCsv } from '../lib/exportCsv'
import type { ActivityLog } from '../types'

export function ActivityPage() {
  const [rows, setRows] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [channelFilter, setChannelFilter] = useState('all')
  const [officerFilter, setOfficerFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    let fetchedData: ActivityLog[] = []
    try {
      const a = await supabase.from('system_activity').select('*').order('created_at', { ascending: false }).limit(200)
      if (a.data && a.data.length > 0) {
        fetchedData = a.data.map((x: any) => ({
          id: String(x.id),
          activity_id: x.activity_id || `ACT-${x.id}`,
          interaction_id: x.interaction_id || '—',
          officer_id: x.officer_id,
          officer_name: x.officer_name || x.actor || x.user_email,
          channel: x.channel || 'System',
          source: x.source || 'Portal',
          customer: x.customer || '—',
          customer_number: x.customer_number || '',
          activity_type: x.activity_type || x.action || x.event_type || 'Activity',
          created_at: x.created_at,
          notes: x.notes || x.detail || x.description || x.message,
        }))
      }
    } catch {
      // Offline fallback
    }

    if (fetchedData.length > 0) {
      setRows(fetchedData)
    } else {
      setRows(DEFAULT_ACTIVITY_LOGS)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const officers = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => {
      if (r.officer_name) set.add(r.officer_name)
    })
    return Array.from(set)
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (officerFilter !== 'all' && r.officer_name !== officerFilter) return false
      if (channelFilter !== 'all' && r.channel !== channelFilter) return false
      if (q.trim()) {
        const query = q.trim().toLowerCase()
        const hay = [
          r.activity_id,
          r.interaction_id,
          r.officer_name,
          r.customer,
          r.customer_number,
          r.activity_type,
          r.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
  }, [rows, officerFilter, channelFilter, q])

  function exportCsv() {
    const headers = ['Activity ID', 'Interaction ID', 'Officer', 'Channel', 'Customer', 'Phone', 'Type', 'Date', 'Notes']
    const data = filteredRows.map((r) => [
      r.activity_id,
      r.interaction_id || '',
      r.officer_name || '',
      r.channel || '',
      r.customer || '',
      r.customer_number || '',
      r.activity_type || '',
      r.created_at || '',
      r.notes || '',
    ])
    downloadCsv(`activity_logs_${new Date().toISOString().slice(0, 10)}.csv`, headers, data)
  }

  return (
    <div className="page">
      <div className="toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="search-input"
          placeholder="Search activity, interaction ID, customer, officer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '1 1 200px' }}
        />
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
          {filteredRows.length} of {rows.length} logs
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="btn sec" onClick={exportCsv} title="Download CSV">
            📥 Export CSV
          </button>
          <button type="button" className="btn sec" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card table-card">
        {loading ? (
          <p className="muted" style={{ padding: 20 }}>Loading activity logs…</p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Activity ID</th>
                  <th style={{ width: 130 }}>Interaction</th>
                  <th>Officer</th>
                  <th>Customer / Contact</th>
                  <th>Activity Type</th>
                  <th className="hide-sm">Channel</th>
                  <th className="hide-sm">Date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty" style={{ textAlign: 'center', padding: 32 }}>
                      No activity logs match the selected filters.
                    </td>
                  </tr>
                )}
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.activity_id}</td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{r.interaction_id || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{r.officer_name || '—'}</td>
                    <td>
                      <div>{r.customer || '—'}</div>
                      {r.customer_number && <div className="muted mono" style={{ fontSize: 11 }}>{r.customer_number}</div>}
                    </td>
                    <td>
                      <span className={`chip ${r.activity_type?.toLowerCase().includes('call') ? 'b' : 'g'}`}>
                        {r.activity_type || 'Activity'}
                      </span>
                    </td>
                    <td className="hide-sm muted" style={{ fontSize: 12 }}>{r.channel || 'Portal'}</td>
                    <td className="hide-sm muted" style={{ fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                    <td style={{ fontSize: 12 }}>{r.notes || '—'}</td>
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
