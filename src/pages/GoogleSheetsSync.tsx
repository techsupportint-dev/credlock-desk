import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { downloadCsv } from '../lib/exportCsv'

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1wG2U2H1NCeHNEwGbxdecJ2EIODTSsDA3xRgMDOZBx5M/edit'
const DEFAULT_SHEET_ID = '1wG2U2H1NCeHNEwGbxdecJ2EIODTSsDA3xRgMDOZBx5M'
const DEFAULT_GID = '0'

type TargetTable = 'tickets' | 'kavro_enrollment' | 'device_ops'

interface ParsedRow {
  [key: string]: string
}

export function GoogleSheetsSyncPage() {
  const { profile, role } = useAuth()
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET_URL)
  const [targetTable, setTargetTable] = useState<TargetTable>('tickets')
  const [rawText, setRawText] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [syncCount, setSyncCount] = useState<number | null>(null)

  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  // Helper to extract spreadsheet ID and gid from URL
  function parseUrlParams(url: string) {
    let sheetId = DEFAULT_SHEET_ID
    let gid = DEFAULT_GID

    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (idMatch) sheetId = idMatch[1]

    const gidMatch = url.match(/[#&?]gid=([0-9]+)/)
    if (gidMatch) gid = gidMatch[1]

    return { sheetId, gid }
  }

  // Parse CSV or TSV string into headers and rows
  function parseDelimited(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return { headers: [], rows: [] }

    // Auto-detect delimiter: comma or tab
    const firstLine = lines[0]
    const delimiter = firstLine.includes('\t') ? '\t' : ','

    const parseLine = (line: string): string[] => {
      if (delimiter === '\t') return line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''))
      // CSV parsing
      const pattern = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g
      const matches = line.match(pattern)
      if (!matches) return line.split(',').map((c) => c.trim())
      return matches.map((m) => m.replace(/^"|"$/g, '').trim())
    }

    const rawHeaders = parseLine(lines[0])
    const rows: ParsedRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = parseLine(lines[i])
      if (parts.length === 0) continue
      const row: ParsedRow = {}
      rawHeaders.forEach((h, idx) => {
        row[h] = parts[idx] || ''
      })
      rows.push(row)
    }

    return { headers: rawHeaders, rows }
  }

  // Auto-suggest initial field mappings based on header names
  function generateDefaultMappings(cols: string[], table: TargetTable): Record<string, string> {
    const map: Record<string, string> = {}
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

    cols.forEach((col) => {
      const n = normalize(col)
      if (table === 'tickets') {
        if (n.includes('ticket') || n === 'id' || n.includes('ref')) map[col] = 'ticket_no'
        else if (n.includes('title') || n.includes('subject') || n.includes('issue')) map[col] = 'title'
        else if (n.includes('status')) map[col] = 'status'
        else if (n.includes('priority') || n.includes('severity')) map[col] = 'priority'
        else if (n.includes('category') || n.includes('type')) map[col] = 'category'
        else if (n.includes('imei') || n.includes('device')) map[col] = 'device_imei'
        else if (n.includes('officer') || n.includes('assign') || n.includes('agent')) map[col] = 'officer'
        else if (n.includes('customer') || n.includes('client') || n.includes('user')) map[col] = 'customer'
        else if (n.includes('merchant') || n.includes('store') || n.includes('agent')) map[col] = 'merchant_name'
        else if (n.includes('desc') || n.includes('note') || n.includes('detail')) map[col] = 'description'
        else if (n.includes('date') || n.includes('created') || n.includes('time')) map[col] = 'created_at'
      } else if (table === 'kavro_enrollment') {
        if (n.includes('imei')) map[col] = 'device_imei'
        else if (n.includes('model') || n.includes('brand')) map[col] = 'device_model'
        else if (n.includes('category') || n.includes('issue') || n.includes('error')) map[col] = 'issue_category'
        else if (n.includes('error') || n.includes('notes') || n.includes('detail')) map[col] = 'error_notes'
        else if (n.includes('action') || n.includes('solution') || n.includes('fix')) map[col] = 'action_taken'
        else if (n.includes('status')) map[col] = 'status'
        else if (n.includes('priority')) map[col] = 'priority'
        else if (n.includes('officer') || n.includes('agent')) map[col] = 'officer'
        else if (n.includes('date') || n.includes('logged')) map[col] = 'date_logged'
      } else {
        if (n.includes('imei') || n.includes('device')) map[col] = 'device_imei'
        else if (n.includes('op') || n.includes('type') || n.includes('action')) map[col] = 'op_type'
        else if (n.includes('status')) map[col] = 'status'
        else if (n.includes('note') || n.includes('desc')) map[col] = 'notes'
        else if (n.includes('officer')) map[col] = 'officer'
      }
    })

    return map
  }

  // Fetch directly from Google Sheets export URL
  async function fetchLiveSheet() {
    setLoading(true)
    setStatusMsg(null)
    setSyncCount(null)

    try {
      const { sheetId, gid } = parseUrlParams(sheetUrl)
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

      const res = await fetch(exportUrl)
      if (!res.ok) {
        throw new Error(
          `Unable to access sheet (${res.status} ${res.statusText}). If the sheet is private, make sure General Access is set to 'Anyone with the link can view' or export/paste CSV.`
        )
      }

      const text = await res.text()
      if (text.includes('<!DOCTYPE html>') || text.includes('Sign in to your Google Account')) {
        throw new Error(
          'Google Sheet requires login. Please click Share in Google Sheets and set "Anyone with the link can view", or copy & paste the cells directly below.'
        )
      }

      const { headers: h, rows: r } = parseDelimited(text)
      if (h.length === 0) {
        throw new Error('No data found in the spreadsheet tab.')
      }

      setHeaders(h)
      setParsedRows(r)
      setMappings(generateDefaultMappings(h, targetTable))
      setStatusMsg({
        type: 'ok',
        text: `Successfully fetched ${r.length} rows and ${h.length} columns from Google Sheet! Review mappings and preview below.`,
      })
    } catch (err: any) {
      setStatusMsg({
        type: 'err',
        text: err?.message || 'Failed to fetch spreadsheet. Try pasting data directly.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle manual paste or text input
  function handleManualParse() {
    if (!rawText.trim()) return
    const { headers: h, rows: r } = parseDelimited(rawText)
    setHeaders(h)
    setParsedRows(r)
    setMappings(generateDefaultMappings(h, targetTable))
    setStatusMsg({
      type: 'ok',
      text: `Parsed ${r.length} rows and ${h.length} columns from input!`,
    })
  }

  // Handle file drop/upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = String(event.target?.result || '')
      setRawText(content)
      const { headers: h, rows: r } = parseDelimited(content)
      setHeaders(h)
      setParsedRows(r)
      setMappings(generateDefaultMappings(h, targetTable))
      setStatusMsg({
        type: 'ok',
        text: `Imported "${file.name}": ${r.length} records ready to map and sync.`,
      })
    }
    reader.readAsText(file)
  }

  // Execute sync into Supabase
  async function executeSync() {
    if (!canWrite) {
      setStatusMsg({ type: 'err', text: 'You do not have write permissions to sync records.' })
      return
    }
    if (parsedRows.length === 0) {
      setStatusMsg({ type: 'err', text: 'No rows to sync. Fetch or paste sheet data first.' })
      return
    }

    setSyncing(true)
    setStatusMsg(null)

    try {
      const recordsToInsert = parsedRows.map((row, idx) => {
        const item: Record<string, any> = {}

        Object.entries(mappings).forEach(([sheetCol, dbCol]) => {
          if (!dbCol || dbCol === '_skip') return
          const val = row[sheetCol]
          if (val !== undefined && val !== '') {
            item[dbCol] = val
          }
        })

        if (targetTable === 'tickets') {
          if (!item.ticket_no) {
            item.ticket_no = `GS-${Date.now().toString().slice(-6)}-${idx + 1}`
          }
          if (!item.title) item.title = `Ticket from Sheet (${item.ticket_no})`
          if (!item.status) item.status = 'New'
          if (!item.priority) item.priority = 'Medium'
        } else if (targetTable === 'kavro_enrollment') {
          if (!item.status) item.status = 'Open'
          if (!item.issue_category) item.issue_category = 'Other'
          if (!item.date_logged) item.date_logged = new Date().toISOString().slice(0, 10)
        } else if (targetTable === 'device_ops') {
          if (!item.status) item.status = 'Open'
          if (!item.op_type) item.op_type = 'Other'
          if (!item.title) item.title = item.op_type || 'Device op'
        }

        return item
      })

      // Batch insert in chunks of 50
      const chunkSize = 50
      let inserted = 0
      for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
        const chunk = recordsToInsert.slice(i, i + chunkSize)
        const { error } = await supabase.from(targetTable).insert(chunk)
        if (error) {
          throw new Error(`Sync error on batch ${i / chunkSize + 1}: ${error.message}`)
        }
        inserted += chunk.length
      }

      setSyncCount(inserted)
      setStatusMsg({
        type: 'ok',
        text: `🎉 Successfully synced ${inserted} records into "${targetTable}" in Supabase!`,
      })

      // Log in activity
      await supabase.from('activity').insert({
        type: 'sync',
        body: `Google Sheets sync executed by ${profile?.email || 'user'}: ${inserted} rows imported into ${targetTable}.`,
        created_by: profile?.email || null,
      })
    } catch (err: any) {
      setStatusMsg({
        type: 'err',
        text: err?.message || 'Sync failed. Check Supabase connection and field formats.',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Export current Supabase table as Sheet-ready CSV
  async function exportExistingToCsv() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from(targetTable).select('*').limit(500)
      if (error) throw error
      if (!data || data.length === 0) {
        setStatusMsg({ type: 'info', text: `No records found in table "${targetTable}" to export.` })
        return
      }

      const cols = Object.keys(data[0])
      const rows = data.map((d: any) => cols.map((c) => d[c]))
      downloadCsv(`credlock_${targetTable}_export_${new Date().toISOString().slice(0, 10)}.csv`, cols, rows)
      setStatusMsg({ type: 'ok', text: `Exported ${data.length} records to CSV file!` })
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Export failed.' })
    } finally {
      setLoading(false)
    }
  }

  const tableFields: Record<TargetTable, { id: string; label: string }[]> = {
    tickets: [
      { id: '_skip', label: '-- Skip Column --' },
      { id: 'ticket_no', label: 'Ticket # / ID' },
      { id: 'title', label: 'Title / Subject' },
      { id: 'status', label: 'Status' },
      { id: 'priority', label: 'Priority' },
      { id: 'category', label: 'Category' },
      { id: 'issue_type', label: 'Issue Type' },
      { id: 'officer', label: 'Assigned Officer' },
      { id: 'device_imei', label: 'Device IMEI' },
      { id: 'customer', label: 'Customer Name' },
      { id: 'customer_phone', label: 'Customer Phone' },
      { id: 'merchant_name', label: 'Merchant' },
      { id: 'description', label: 'Description / Details' },
      { id: 'source', label: 'Source Channel' },
      { id: 'created_at', label: 'Created At / Date' },
    ],
    kavro_enrollment: [
      { id: '_skip', label: '-- Skip Column --' },
      { id: 'device_imei', label: 'Device IMEI' },
      { id: 'device_model', label: 'Device Model' },
      { id: 'issue_category', label: 'Issue Category' },
      { id: 'error_notes', label: 'Error Notes' },
      { id: 'action_taken', label: 'Action Taken' },
      { id: 'status', label: 'Status' },
      { id: 'priority', label: 'Priority' },
      { id: 'officer', label: 'Officer' },
      { id: 'date_logged', label: 'Date Logged' },
      { id: 'resolution_date', label: 'Resolution Date' },
      { id: 'additional_notes', label: 'Additional Notes' },
    ],
    device_ops: [
      { id: '_skip', label: '-- Skip Column --' },
      { id: 'op_type', label: 'Operation Type' },
      { id: 'device_imei', label: 'Device IMEI' },
      { id: 'title', label: 'Title' },
      { id: 'status', label: 'Status' },
      { id: 'notes', label: 'Notes' },
      { id: 'officer', label: 'Officer' },
      { id: 'created_at', label: 'Date / Time' },
    ],
  }

  return (
    <div className="page">
      <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>Google Sheets Live Integration & Sync Hub</h2>
          <p className="muted" style={{ margin: 0 }}>
            Connect, map, and synchronize CredLock operations with Google Sheets.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn sec" onClick={exportExistingToCsv} disabled={loading}>
            📥 Export {targetTable} to CSV
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            background:
              statusMsg.type === 'ok'
                ? 'rgba(26, 127, 75, 0.12)'
                : statusMsg.type === 'err'
                ? 'rgba(179, 38, 30, 0.12)'
                : 'rgba(11, 110, 117, 0.12)',
            color:
              statusMsg.type === 'ok'
                ? 'var(--ok)'
                : statusMsg.type === 'err'
                ? 'var(--bad)'
                : 'var(--acc)',
            border: `1px solid ${
              statusMsg.type === 'ok'
                ? 'rgba(26, 127, 75, 0.3)'
                : statusMsg.type === 'err'
                ? 'rgba(179, 38, 30, 0.3)'
                : 'rgba(11, 110, 117, 0.3)'
            }`,
            fontSize: '13.5px',
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Target Table & Configuration Card */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚙️</span> 1. Select Supabase Destination Table
        </h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['tickets', 'kavro_enrollment', 'device_ops'] as TargetTable[]).map((tbl) => (
            <label
              key={tbl}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '8px 14px',
                borderRadius: 8,
                background: targetTable === tbl ? 'var(--acc2)' : 'transparent',
                border: `1px solid ${targetTable === tbl ? 'var(--acc)' : 'var(--line)'}`,
                fontWeight: targetTable === tbl ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name="targetTable"
                value={tbl}
                checked={targetTable === tbl}
                onChange={() => {
                  setTargetTable(tbl)
                  if (headers.length > 0) {
                    setMappings(generateDefaultMappings(headers, tbl))
                  }
                }}
              />
              {tbl === 'tickets' ? '🎫 Tickets & Requests' : tbl === 'kavro_enrollment' ? '📱 KAVRO Enrollment' : '🔧 Device Operations'}
            </label>
          ))}
        </div>
      </div>

      {/* Sheet Connection Methods */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔗</span> 2. Connect to Google Sheet
        </h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mute)', marginBottom: 6 }}>
            Google Sheet URL / Document Link
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..."
              style={{
                flex: 1,
                minWidth: 280,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
              }}
            />
            <button
              type="button"
              className="btn"
              onClick={fetchLiveSheet}
              disabled={loading || !sheetUrl.trim()}
              style={{ minWidth: 160 }}
            >
              {loading ? 'Fetching Sheet…' : '⚡ Live Fetch & Parse'}
            </button>
            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="btn sec"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              ↗ Open in Google Sheets
            </a>
          </div>
          <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8, lineHeight: 1.5 }}>
            💡 <strong>Permission Tip:</strong> In Google Sheets, make sure to click <strong>Share</strong> → change General access to <strong>"Anyone with the link can view"</strong> for live browser sync. Alternatively, use direct CSV upload or paste below.
          </div>
        </div>

        <details style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--acc)', fontSize: 13 }}>
            ▶ Or Paste / Upload CSV or TSV directly
          </summary>
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                style={{ fontSize: 13 }}
              />
            </div>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste tab-delimited or comma-separated rows from your spreadsheet here..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            />
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn sec" onClick={handleManualParse}>
                Parse Pasted Content
              </button>
            </div>
          </div>
        </details>
      </div>

      {/* Column Mapping Section */}
      {headers.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🗺️</span> 3. Map Sheet Columns to CredLock Database Fields
            </h3>
            <span className="muted" style={{ fontSize: 12 }}>
              {headers.length} sheet columns detected
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {headers.map((col) => (
              <div
                key={col}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col}>
                  Sheet Column: <span style={{ color: 'var(--acc)' }}>{col}</span>
                </div>
                <select
                  value={mappings[col] || '_skip'}
                  onChange={(e) => setMappings({ ...mappings, [col]: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--line)',
                    background: 'var(--panel)',
                    color: 'var(--ink)',
                    fontSize: 12,
                  }}
                >
                  {tableFields[targetTable].map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview & Execute Sync */}
      {parsedRows.length > 0 && (
        <div className="card table-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>👁️</span> 4. Preview & Execute Sync ({parsedRows.length} total rows)
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Displaying first 10 rows formatted according to your mapping.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={executeSync}
              disabled={syncing || !canWrite}
              style={{
                background: 'linear-gradient(135deg, #0b6e75, #1a7f4b)',
                color: '#fff',
                fontSize: 14,
                padding: '10px 20px',
                fontWeight: 600,
              }}
            >
              {syncing ? 'Syncing to Supabase…' : `🚀 Sync ${parsedRows.length} Rows to ${targetTable}`}
            </button>
          </div>

          <div className="tw" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {headers.map((h) => (
                    <th key={h}>
                      {h}
                      {mappings[h] && mappings[h] !== '_skip' && (
                        <div style={{ fontSize: 10, color: 'var(--acc)', fontWeight: 'normal' }}>
                          → {mappings[h]}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    <td className="mono muted">{idx + 1}</td>
                    {headers.map((h) => (
                      <td key={h} style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row[h] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
