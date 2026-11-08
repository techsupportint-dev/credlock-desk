import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Incident } from '../types'

export function IncidentsPage() {
  const [rows, setRows] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!cancelled) {
          setRows((data as Incident[]) || [])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
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
                  <th className="hide-sm">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No incidents
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title || '—'}</td>
                    <td>{r.severity || '—'}</td>
                    <td>
                      <span className="chip b">{r.status || '—'}</span>
                    </td>
                    <td className="hide-sm muted">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </td>
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
