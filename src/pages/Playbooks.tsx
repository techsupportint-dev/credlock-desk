import { useCallback, type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { fmtDate } from '../lib/sla'

interface Row {
  id: string
  title?: string
  category?: string
  problem?: string
  steps?: string
  escalate?: string
  created_at?: string
}

const DEFAULT_PLAYBOOKS: Row[] = [
  {
    id: 'kb-0001',
    title: 'Overview of CredLock Technical Support Operations',
    category: 'General Support',
    problem: 'Support CredLock BNPL operations by resolving technical complaints from customers, merchants and internal departments.',
    steps: '1. Device troubleshooting.\n2. Enrollment support and IMEI validation.\n3. KAVRO and FDX issue management.\n4. Incident documentation and ticket escalation to Engineering.\n5. Coordinate with Compliance and Merchant Relations when policy intervention is required.',
    escalate: 'Escalate to Engineering or Compliance based on incident severity matrix.',
    created_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'kb-0002',
    title: 'Device / App Unlock — Recurring Workload & Standard Response',
    category: 'Unlock / Removal',
    problem: 'Device / app unlock requests account for 81% of operations volume (manual removals and unlocks).',
    steps: '1. Verify settlement receipt in Paystack / Core Banking.\n2. Execute unlock command via Device Operations console.\n3. Verify device state propagation over cellular / WiFi.\n4. Send confirmation SMS to customer.',
    escalate: 'Automate payment / extension unlock and monitor state propagation.',
    created_at: '2026-10-31T09:00:00.000Z',
  },
  {
    id: 'kb-0003',
    title: 'Device Lock / Full Lock After Payment Resolution',
    category: 'Unlock / Removal',
    problem: 'Device remains locked after the customer has paid or extended loan terms.',
    steps: '1. Check payment webhook delivery timestamp.\n2. Check server-to-device policy receipt.\n3. Issue manual override full-lock release.\n4. Request customer to restart device or toggle airplane mode.',
    escalate: 'Escalate to Engineering if device remains locked >15 minutes post-payment.',
    created_at: '2026-10-31T10:00:00.000Z',
  },
  {
    id: 'kb-0004',
    title: 'App / X Manager Removal Standard SOP',
    category: 'Unlock / Removal',
    problem: 'Manager / Credlock / X Manager app removal after full loan completion.',
    steps: '1. Verify zero loan balance in finance portal.\n2. Issue Release Device & Remove Profile command from console.\n3. Prompt customer to complete uninstallation wizard.\n4. Record completion receipt in Issue Log.',
    escalate: 'Escalate to Finance if payment verification is ambiguous.',
    created_at: '2026-10-31T11:00:00.000Z',
  },
  {
    id: 'kb-0005',
    title: 'Paid-but-Locked Complaints: FDX versus KAVRO Diagnostic',
    category: 'KAVRO Sync',
    problem: 'Why paid-but-locked complaints originate mostly from FDX compared to KAVRO.',
    steps: '1. For FDX: Customer repays -> device stays locked -> priority manual unlock required.\n2. For KAVRO: Customer repays -> device connects to mobile data -> auto-lock releases.\n3. Identify customer engine type before executing commands.',
    escalate: 'Engineering escalation for root-cause engine synchronization.',
    created_at: '2026-10-31T12:00:00.000Z',
  },
]

export function PlaybooksPage() {
  const { role } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Row | null>(null)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const canWrite = ['Super Admin', 'Team Lead', 'Officer'].includes(String(role))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) setMsg(error.message)
      setRows(data && data.length > 0 ? (data as Row[]) : DEFAULT_PLAYBOOKS)
    } catch {
      setRows(DEFAULT_PLAYBOOKS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return [r.title, r.category, r.problem].filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
  })

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    const { error } = await supabase.from('playbooks').insert({
      title: String(fd.get('title') || '').trim(),
      category: String(fd.get('category') || '') || null,
      problem: String(fd.get('problem') || '') || null,
      steps: String(fd.get('steps') || '') || null,
      escalate: String(fd.get('escalate') || '') || null,
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
        <input className="search-input" placeholder="Search playbooks…" value={q} onChange={(e) => setQ(e.target.value)} />
        {canWrite && <button type="button" className="btn" onClick={() => setShow(true)}>+ New playbook</button>}
        <button type="button" className="btn sec" onClick={() => load()}>Refresh</button>
      </div>
      {msg && <div className="auth-error">{msg}</div>}
      <div className="card table-card">
        {loading ? <p className="muted">Loading…</p> : (
          <div className="tw">
            <table>
              <thead><tr><th>Title</th><th>Category</th><th className="hide-sm">Problem</th><th className="hide-sm">Created</th></tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={4} className="empty">No playbooks</td></tr>}
                {filtered.map((r) => (
                  <tr key={r.id} className="click" onClick={() => setSelected(r)}>
                    <td>{r.title}</td>
                    <td><span className="chip b">{r.category || '—'}</span></td>
                    <td className="hide-sm">{(r.problem || '—').slice(0, 80)}</td>
                    <td className="hide-sm muted">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && (
        <Modal title={selected.title || 'Playbook'} onClose={() => setSelected(null)}>
          <div className="detail-grid">
            <div className="detail-row"><div className="label">Category</div><div className="value">{selected.category || '—'}</div></div>
            <div className="detail-row"><div className="label">Problem</div><div className="value">{selected.problem || '—'}</div></div>
            <div className="detail-row"><div className="label">Steps</div><div className="value" style={{ whiteSpace: 'pre-wrap' }}>{selected.steps || '—'}</div></div>
            <div className="detail-row"><div className="label">Escalate when</div><div className="value">{selected.escalate || '—'}</div></div>
          </div>
        </Modal>
      )}
      {show && (
        <Modal title="New playbook" onClose={() => setShow(false)} wide
          footer={<><button type="button" className="btn sec" onClick={() => setShow(false)}>Cancel</button><button type="submit" form="pb-form" className="btn" disabled={busy}>Save</button></>}>
          <form id="pb-form" className="form-grid" onSubmit={create}>
            <div className="span-2"><label>Title *</label><input name="title" required /></div>
            <div><label>Category</label><input name="category" placeholder="e.g. Device Unlock" /></div>
            <div className="span-2"><label>Problem</label><textarea name="problem" rows={2} /></div>
            <div className="span-2"><label>Steps</label><textarea name="steps" rows={5} /></div>
            <div className="span-2"><label>Escalate when</label><input name="escalate" /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
