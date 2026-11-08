import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Row {
  id: string
  email?: string
  full_name?: string
  name?: string
  role?: string
  account_status?: string
}

export function OfficersPage({ teamMode }: { teamMode?: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const profiles = await supabase
        .from('profiles')
        .select('id, email, full_name, role, account_status')
        .limit(200)
      if (!cancelled && profiles.data?.length) {
        setRows(profiles.data as Row[])
        setLoading(false)
        return
      }
      const team = await supabase.from('team').select('id, email, name, role').limit(200)
      if (!cancelled) {
        setRows((team.data as Row[]) || [])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
      <div className="card brand-header" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>{teamMode ? 'Team directory' : 'Officers'}</h3>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Profiles and roles from Supabase
        </p>
      </div>
      <div className="card table-card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="hide-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No officers found
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.full_name || r.name || '—'}</td>
                    <td>{r.email || '—'}</td>
                    <td>
                      <span className="chip b">{r.role || '—'}</span>
                    </td>
                    <td className="hide-sm">{r.account_status || 'Active'}</td>
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
