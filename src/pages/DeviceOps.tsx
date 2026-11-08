import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Row {
  id: string
  title?: string
  status?: string
  device_type?: string
  created_at?: string
}

export function DeviceOpsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [kavro, setKavro] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('device_ops').select('*').limit(150),
      supabase.from('kavro_enrollment').select('*').limit(150),
    ]).then(([d, k]) => {
      if (cancelled) return
      setRows((d.data as Row[]) || [])
      setKavro(
        ((k.data as any[]) || []).map((x) => ({
          id: x.id,
          title: x.device_model || x.issue_category || 'KAVRO',
          status: x.status,
          device_type: x.device_imei,
          created_at: x.created_at || x.date_logged,
        }))
      )
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const list = [...rows, ...kavro]

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
                  <th>Item</th>
                  <th>Status</th>
                  <th className="hide-sm">Ref</th>
                  <th className="hide-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No device operations yet
                    </td>
                  </tr>
                )}
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title || '—'}</td>
                    <td>
                      <span className="chip b">{r.status || '—'}</span>
                    </td>
                    <td className="hide-sm mono">{r.device_type || '—'}</td>
                    <td className="hide-sm muted">
                      {r.created_at ? String(r.created_at).slice(0, 10) : '—'}
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
