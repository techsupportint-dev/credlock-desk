import { supabase } from './supabase.js'

/**
 * CredLock Technical Support Platform
 * Central system for recording, monitoring, managing, investigating,
 * escalating and reporting all technical support activities.
 * Real Supabase Postgres database – not a demo or mock.
 */

// ─── State ───────────────────────────────────────────────────
let currentUser = null
let currentProfile = null
let currentRole = 'Viewer'
let activeTab = 'dashboard'

let tickets = []
let profiles = []
let departments = []
let kavro = []
let incidents = []
let playbooks = []
let recommendations = []
let systemActivity = []
let categories = []
let priorities = []
let dailyReports = []
let departmentActivity = []
let ticketNotes = [] // from activity table filtered by ticket
let incidentNotes = []
let deviceOps = []
let documents = []
let managementReports = []
let ticketHistory = []
let kavroFilters = { q: '', status: '', category: '' }

// Spec-aligned catalogs
const STATUSES = ['New', 'Assigned', 'In Progress', 'Pending', 'Escalated', 'Resolved', 'Closed', 'Reopened']
const LEGACY_STATUS_MAP = {
  OPEN: 'New', IN_PROGRESS: 'In Progress', WAITING: 'Pending', RESOLVED: 'Resolved', CLOSED: 'Closed'
}
const PRIOS = ['P1 Critical', 'P2 High', 'P3 Normal', 'P4 Low']
const PRIORITY_CODES = {
  'P1 Critical': { code: 'P1', minutes: 5, label: 'Critical' },
  'P2 High': { code: 'P2', minutes: 10, label: 'High' },
  'P3 Normal': { code: 'P3', minutes: 30, label: 'Normal' },
  'P4 Low': { code: 'P4', minutes: 120, label: 'Low' },
  Critical: { code: 'P1', minutes: 5, label: 'Critical' },
  High: { code: 'P2', minutes: 10, label: 'High' },
  Medium: { code: 'P3', minutes: 30, label: 'Normal' },
  Low: { code: 'P4', minutes: 120, label: 'Low' }
}
const ISSUE_TYPES = [
  'Customer Support',
  'Merchant Support',
  'Enrollment',
  'Device / MDM',
  'KAVRO',
  'FDX',
  'Application / Platform',
  'Payment / Transaction',
  'IMEI Validation',
  'BNPL Device Swap',
  'Device Unlock',
  'Account Access',
  'Internal Staff Request',
  'Incident / Outage',
  'Other'
]
const REQUESTER_TYPES = ['Customer', 'Merchant', 'Internal', 'Partner']
const SOURCE_CHANNELS = ['Email', 'Phone', 'WhatsApp', 'Portal', 'Walk-in', 'Internal', 'Other']
const KAV_CATS = ['QR Code Error', 'APK Install Error', 'Config Error', 'Policy Sync', 'Lock/Unlock', 'IMEI Validation', 'Device Removal', 'Other']
const KAV_STATUSES = ['Resolved', 'In Progress', 'Pending Review', 'Open', 'Escalated']
const ACCOUNT_STATUSES = ['Active', 'Inactive', 'Suspended']
const ROLES = ['Super Admin', 'Team Lead', 'Officer', 'Viewer']
const DEVICE_OPS_TYPES = ['KAVRO_MDM', 'FDX', 'BNPL', 'ENROLLMENT']
const INCIDENT_SEVERITIES = ['Critical', 'High', 'Medium', 'Low']
const INCIDENT_STATUSES = ['Open', 'Investigating', 'Contained', 'Resolved', 'Closed']

// ─── Helpers ─────────────────────────────────────────────────
function $(sel) { return document.querySelector(sel) }
function esc(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
function chipP(p) {
  const key = String(p || '')
  const isCrit = key.includes('P1') || key === 'Critical' || key.includes('Critical')
  const isHigh = key.includes('P2') || key === 'High' || key.includes('High')
  const isNorm = key.includes('P3') || key === 'Medium' || key.includes('Normal')
  const c = isCrit ? 'r' : isHigh ? 'y' : isNorm ? 'b' : 'b'
  return `<span class="chip ${c}">${esc(p)}</span>`
}
function chipS(s) {
  const u = String(s || '')
  if (['Resolved', 'RESOLVED', 'Closed', 'CLOSED', 'Active', 'Completed', 'Contained'].includes(u)) return `<span class="chip g">${esc(s)}</span>`
  if (['Pending', 'Pending Review', 'WAITING', 'Suspended', 'In Progress', 'Assigned', 'Investigating', 'Reopened'].includes(u)) return `<span class="chip y">${esc(s)}</span>`
  if (['Inactive', 'Escalated', 'New', 'OPEN'].includes(u)) return `<span class="chip r">${esc(s)}</span>`
  return `<span class="chip b">${esc(s)}</span>`
}
function normalizeStatus(s) {
  if (!s) return 'New'
  return LEGACY_STATUS_MAP[s] || s
}
function priorityMeta(p) {
  return PRIORITY_CODES[p] || PRIORITY_CODES['P3 Normal']
}
function ticketAgeMinutes(t) {
  if (!t?.created_at) return null
  return Math.floor((Date.now() - new Date(t.created_at).getTime()) / 60000)
}
function firstResponseMinutes(t) {
  if (!t?.first_response_at || !t?.created_at) return null
  return Math.floor((new Date(t.first_response_at) - new Date(t.created_at)) / 60000)
}
function isSlaBreached(t) {
  if (['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(normalizeStatus(t.status))) return false
  if (t.sla_breached) return true
  const meta = priorityMeta(t.priority || t.priority_code)
  const age = ticketAgeMinutes(t)
  if (age == null) return false
  // First response SLA: breach if no first response and age exceeds target
  if (!t.first_response_at && age > meta.minutes) return true
  if (t.sla_due_at && new Date(t.sla_due_at) < new Date()) return true
  return false
}
function isSlaApproaching(t) {
  if (isSlaBreached(t)) return false
  if (['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(normalizeStatus(t.status))) return false
  const meta = priorityMeta(t.priority || t.priority_code)
  const age = ticketAgeMinutes(t)
  if (age == null || t.first_response_at) return false
  return age >= meta.minutes * 0.7
}
function slaBadge(t) {
  if (isSlaBreached(t)) return '<span class="chip r">SLA BREACH</span>'
  if (isSlaApproaching(t)) return '<span class="chip y">SLA risk</span>'
  return ''
}
function officerStats(profileId, email) {
  const mine = tickets.filter(t => {
    if (profileId && t.assigned_to === profileId) return true
    if (email && (t.officer || '').toLowerCase() === email.toLowerCase()) return true
    return false
  })
  const resolved = mine.filter(t => ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(normalizeStatus(t.status))).length
  const pending = mine.filter(t => !['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(normalizeStatus(t.status))).length
  const escalated = mine.filter(t => t.escalated || normalizeStatus(t.status) === 'Escalated').length
  const times = mine.map(firstResponseMinutes).filter(x => x != null)
  const avgResp = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null
  return {
    assigned: mine.length,
    resolved,
    pending,
    escalated,
    avgResponseMin: avgResp,
    resolutionRate: mine.length ? Math.round((resolved / mine.length) * 100) : 0
  }
}
function isSuperAdmin() { return currentRole === 'Super Admin' }
function isTeamLead() { return currentRole === 'Team Lead' || isSuperAdmin() }
/** Team Lead acts as Department Head / authorized departmental user */
function isDeptHead() { return currentRole === 'Team Lead' || isSuperAdmin() }
function isOfficer() { return currentRole === 'Officer' }
function canWrite() { return ['Super Admin', 'Team Lead', 'Officer'].includes(currentRole) }
function canDelete() { return isSuperAdmin() || isTeamLead() }
function canManageUsers() { return isSuperAdmin() }
function canAssign() { return isTeamLead() }
function canManageDepartments() { return isSuperAdmin() }
function myEmail() { return (currentProfile?.email || currentUser?.email || '').toLowerCase() }
function myDeptId() { return currentProfile?.department_id || null }
function isAssignedToMe(t) {
  const email = myEmail()
  if (!email) return false
  if ((t.officer || '').toLowerCase() === email) return true
  if (t.assigned_to && currentProfile?.id && t.assigned_to === currentProfile.id) return true
  return false
}
function isMyDepartmentTicket(t) {
  if (!myDeptId()) return false
  return t.department_id === myDeptId()
}
function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(d).slice(0, 16)
  }
}
function fmtDay(d) {
  if (!d) return '—'
  return String(d).slice(0, 10)
}
function toast(msg) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2800)
}
function closeModal() {
  const m = $('.modal-backdrop')
  if (m) m.remove()
}
async function logActivity(action, entityType, entityId, details) {
  try {
    await supabase.from('system_activity').insert({
      actor_id: currentProfile?.id || null,
      actor_email: currentUser?.email || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: details || null
    })
  } catch (_) { /* non-blocking */ }
}

// ─── Auth ────────────────────────────────────────────────────
export function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-box card">
      <h2>CredLock Technical Support</h2>
      <p>Central platform for tickets, incidents, devices, KAVRO, BNPL, payments and internal support.</p>
      <div id="auth-error" class="auth-error hidden"></div>
      <label>Email</label>
      <input id="email" type="email" placeholder="you@company.com" style="width:100%;margin-bottom:12px">
      <label>Password</label>
      <input id="password" type="password" placeholder="••••••••" style="width:100%;margin-bottom:16px">
      <button class="btn" style="width:100%" id="login-btn">Sign in</button>
      <p style="margin-top:16px;font-size:12px;text-align:center" class="muted">
        Accounts are created by Super Admin. Contact your administrator for access.
      </p>
    </div>
  `
  $('#login-btn').onclick = async () => {
    const email = $('#email').value.trim()
    const password = $('#password').value
    const errEl = $('#auth-error')
    errEl.classList.add('hidden')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      errEl.textContent = error.message
      errEl.classList.remove('hidden')
    }
  }
  $('#password').onkeydown = (e) => { if (e.key === 'Enter') $('#login-btn').click() }
}

export async function renderApp(user) {
  currentUser = user
  await loadProfile()
  if (currentProfile?.account_status === 'Suspended' || currentProfile?.account_status === 'Inactive') {
    document.getElementById('app').innerHTML = `
      <div class="login-box card">
        <h2>Account ${esc(currentProfile.account_status)}</h2>
        <p>Your account is ${esc(currentProfile.account_status)}. Contact a Super Admin.</p>
        <p class="muted">${esc(currentProfile.status_reason || '')}</p>
        <button class="btn sec" id="logout-btn" style="margin-top:12px">Sign out</button>
      </div>
    `
    $('#logout-btn').onclick = () => supabase.auth.signOut()
    return
  }
  await loadAllData()

  document.getElementById('app').innerHTML = `
    <header>
      <h1>CredLock Technical Support</h1>
      <div class="sp"></div>
      <span class="who">${esc(currentProfile?.full_name || user.email)} · ${esc(currentRole)}</span>
      <button class="btn sec" id="theme-btn">Theme</button>
      <button class="btn sec" id="logout-btn">Sign out</button>
    </header>
    <nav id="nav">
      <button data-tab="dashboard" class="on">Dashboard / KPI</button>
      <button data-tab="tickets">${isOfficer() && !isTeamLead() ? 'My Tickets' : 'Tickets'}</button>
      <button data-tab="officers">Officers</button>
      ${isOfficer() || isDeptHead() ? '<button data-tab="daily">Daily Report</button>' : ''}
      ${isOfficer() || isDeptHead() ? '<button data-tab="metrics">My Metrics</button>' : ''}
      <button data-tab="deviceops">Device Ops</button>
      <button data-tab="kavro">Kavro Enrollment</button>
      <button data-tab="incidents">Incidents</button>
      <button data-tab="documents">Documents</button>
      <button data-tab="recommendations">Recommendations</button>
      ${isTeamLead() ? '<button data-tab="users">Users</button>' : ''}
      ${isSuperAdmin() ? '<button data-tab="departments">Departments</button>' : ''}
      ${isSuperAdmin() ? '<button data-tab="activity">Activity Log</button>' : ''}
      <button data-tab="reports">Reports</button>
      <button data-tab="team">Team</button>
    </nav>
    <main id="main"></main>
  `

  $('#logout-btn').onclick = () => supabase.auth.signOut()
  $('#theme-btn').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme')
    document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark')
  }

  document.querySelectorAll('#nav button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#nav button').forEach(b => b.classList.remove('on'))
      btn.classList.add('on')
      activeTab = btn.dataset.tab
      renderTab()
    }
  })

  renderTab()
}

async function loadProfile() {
  // Prefer profiles table (new model)
  const { data } = await supabase
    .from('profiles')
    .select('*, departments(name)')
    .eq('email', currentUser.email)
    .maybeSingle()

  if (data) {
    currentProfile = data
    currentRole = data.role || 'Viewer'
    return
  }

  // Fallback: old team table
  const { data: teamRow } = await supabase
    .from('team')
    .select('*')
    .eq('email', currentUser.email)
    .eq('active', true)
    .maybeSingle()

  if (teamRow) {
    currentRole = teamRow.role === 'Admin' ? 'Super Admin' : (teamRow.role || 'Viewer')
    currentProfile = {
      id: null,
      email: currentUser.email,
      full_name: teamRow.name || currentUser.email,
      role: currentRole,
      account_status: 'Active'
    }
  } else {
    // First signed-in user with no profile → treat as Super Admin bootstrap
    currentRole = 'Super Admin'
    currentProfile = {
      id: null,
      email: currentUser.email,
      full_name: currentUser.email,
      role: 'Super Admin',
      account_status: 'Active'
    }
  }
}

async function loadAllData() {
  const queries = [
    supabase.from('tickets').select('*').order('created_at', { ascending: false }),
    supabase.from('kavro_enrollment').select('*').order('date_logged', { ascending: false }),
    supabase.from('incidents').select('*').order('created_at', { ascending: false }),
    supabase.from('playbooks').select('*').order('title')
  ]

  // Optional enterprise tables (may not exist until migrations 003–005 run)
  const optional = await Promise.all([
    supabase.from('profiles').select('*, departments(name)').order('full_name'),
    supabase.from('departments').select('*').order('name'),
    supabase.from('recommendations').select('*').order('created_at', { ascending: false }),
    supabase.from('system_activity').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('ticket_categories').select('*').order('sort_order'),
    supabase.from('ticket_priorities').select('*').order('sort_order'),
    supabase.from('team').select('*').order('name'),
    supabase.from('daily_reports').select('*').order('report_date', { ascending: false }).limit(90),
    supabase.from('department_activity').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('incident_notes').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('device_ops').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('management_reports').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('ticket_history').select('*').order('created_at', { ascending: false }).limit(300)
  ])

  const [t, k, i, p] = await Promise.all(queries)
  tickets = (t.data || []).map(x => ({ ...x, status: normalizeStatus(x.status) }))
  kavro = k.data || []
  incidents = i.data || []
  playbooks = p.data || []

  profiles = optional[0].data || []
  departments = optional[1].data || []
  recommendations = optional[2].data || []
  systemActivity = optional[3].data || []
  categories = optional[4].data || []
  priorities = optional[5].data || []
  dailyReports = optional[7].data || []
  departmentActivity = optional[8].data || []
  ticketNotes = optional[9].data || []
  incidentNotes = optional[10].data || []
  deviceOps = optional[11].data || []
  documents = optional[12].data || []
  managementReports = optional[13].data || []
  ticketHistory = optional[14].data || []

  // Merge old team into profiles view if profiles empty
  if (!profiles.length && optional[6].data?.length) {
    profiles = (optional[6].data || []).map(m => ({
      id: m.id || m.email,
      email: m.email,
      full_name: m.name,
      role: m.role === 'Admin' ? 'Super Admin' : m.role,
      account_status: m.active ? 'Active' : 'Inactive',
      departments: null
    }))
  }
}

// ─── Tabs ────────────────────────────────────────────────────
function renderTab() {
  const main = $('#main')
  const map = {
    dashboard: viewDashboard,
    tickets: viewTickets,
    officers: viewOfficers,
    daily: viewDailyReport,
    metrics: viewMyMetrics,
    deviceops: viewDeviceOps,
    kavro: viewKavro,
    incidents: viewIncidents,
    documents: viewDocuments,
    recommendations: viewRecommendations,
    users: viewUsers,
    departments: viewDepartments,
    activity: viewActivity,
    reports: viewReports,
    team: viewTeam
  }
  main.innerHTML = (map[activeTab] || viewDashboard)()
  wireTabEvents()
}

function wireTabEvents() {
  const createTicket = $('#create-ticket')
  if (createTicket) createTicket.onclick = () => openTicketForm()

  const applyFilters = $('#apply-filters')
  if (applyFilters) applyFilters.onclick = () => renderTab()

  const createKavro = $('#create-kavro')
  if (createKavro) createKavro.onclick = () => openKavroForm()

  const applyKav = $('#apply-kav-filters')
  if (applyKav) {
    applyKav.onclick = () => {
      kavroFilters.q = ($('#kq')?.value || '').trim()
      kavroFilters.status = $('#kst')?.value || ''
      kavroFilters.category = $('#kct')?.value || ''
      renderTab()
    }
  }

  const addDept = $('#add-dept')
  if (addDept) addDept.onclick = () => openDeptForm()

  const addRec = $('#add-rec')
  if (addRec) addRec.onclick = () => openRecForm()

  const addIncident = $('#add-incident')
  if (addIncident) addIncident.onclick = () => openIncidentForm()

  const saveDaily = $('#save-daily')
  if (saveDaily) saveDaily.onclick = () => submitDailyReport()

  const applyOff = $('#apply-off-filters')
  if (applyOff) applyOff.onclick = () => renderTab()

  const exportOff = $('#export-officers')
  if (exportOff) exportOff.onclick = () => exportOfficersCsv()

  const applyDo = $('#apply-do-filters')
  if (applyDo) applyDo.onclick = () => renderTab()

  const addDo = $('#add-device-ops')
  if (addDo) addDo.onclick = () => openDeviceOpsForm()

  const applyDoc = $('#apply-doc-filters')
  if (applyDoc) applyDoc.onclick = () => renderTab()

  const genReport = $('#gen-report')
  if (genReport) genReport.onclick = () => generateManagementReport()
}

function exportOfficersCsv() {
  const rows = [['Full name', 'Staff ID', 'Email', 'Phone', 'Department', 'Designation', 'Role', 'Status', 'Date joined', 'Assigned', 'Resolved', 'Pending', 'Escalated', 'Avg response (min)', 'Resolution rate %']]
  profiles.forEach(p => {
    const st = officerStats(p.id, p.email)
    rows.push([
      p.full_name, p.staff_id || '', p.official_email || p.email, p.phone || '',
      p.departments?.name || '', p.designation || '', p.role, p.account_status || 'Active',
      p.date_joined || '', st.assigned, st.resolved, st.pending, st.escalated,
      st.avgResponseMin != null ? st.avgResponseMin : '', st.resolutionRate
    ])
  })
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'credlock-officers-' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  toast('Officers exported')
}

function openDeviceOpsForm() {
  showModal('New device / technical operations record', `
    <div class="form-grid">
      <div><label>Ops type</label><select id="do_type" style="width:100%">${DEVICE_OPS_TYPES.map(t => `<option value="${t}">${t.replace('_', ' / ')}</option>`).join('')}</select></div>
      <div><label>Title</label><input id="do_title" style="width:100%"></div>
      <div><label>Reference</label><input id="do_ref" style="width:100%"></div>
      <div><label>IMEI</label><input id="do_imei" style="width:100%"></div>
      <div><label>Priority</label><select id="do_pri" style="width:100%">${PRIOS.map(p => `<option>${p}</option>`).join('')}</select></div>
      <div><label>Status</label><select id="do_st" style="width:100%"><option>Open</option><option>In Progress</option><option>Pending</option><option>Resolved</option></select></div>
      <div style="grid-column:1/-1"><label>Notes</label><textarea id="do_notes" rows="3" style="width:100%"></textarea></div>
    </div>
  `, `<button class="btn" id="save-do">Save</button>`)
  $('#save-do').onclick = async () => {
    const payload = {
      ops_type: $('#do_type').value,
      title: $('#do_title').value,
      reference_no: $('#do_ref').value || null,
      device_imei: $('#do_imei').value || null,
      priority: $('#do_pri').value,
      status: $('#do_st').value,
      notes: $('#do_notes').value || null,
      officer_id: currentProfile?.id || null
    }
    const { error } = await supabase.from('device_ops').insert(payload)
    if (error) { toast(error.message); return }
    toast('Device ops record saved')
    closeModal()
    await loadAllData()
    renderTab()
  }
}

async function generateManagementReport() {
  const type = $('#rpt-type')?.value || 'monthly'
  const start = $('#rpt-start')?.value || null
  const end = $('#rpt-end')?.value || null
  const resolved = tickets.filter(t => ['Resolved', 'Closed'].includes(normalizeStatus(t.status))).length
  const breached = tickets.filter(isSlaBreached).length
  const openInc = incidents.filter(i => !['Resolved', 'Closed'].includes(i.status)).length
  const total = tickets.length
  const rate = total ? Math.round((resolved / total) * 100) : 0
  const payload = {
    report_type: type,
    period_start: start,
    period_end: end,
    ticket_total: total,
    ticket_resolved: resolved,
    resolution_rate: rate,
    sla_breaches: breached,
    incidents_open: openInc,
    kavro_total: kavro.length,
    device_ops_total: deviceOps.length,
    escalated: tickets.filter(t => t.escalated).length,
    officers_active: profiles.filter(p => p.account_status === 'Active' && p.role === 'Officer').length,
    generated_at: new Date().toISOString(),
    note: 'Figures from live system records only. Missing period history shown as Not Available.'
  }
  try {
    const { error } = await supabase.from('management_reports').insert({
      report_type: type,
      title: `CredLock ${type} Technical Support Report`,
      period_start: start || null,
      period_end: end || null,
      generated_by: currentProfile?.id || null,
      payload,
      status: 'Generated'
    })
    if (error) toast('Report opened (DB note: ' + error.message + ')')
    else toast('Management report saved and opened for print/PDF')
  } catch (e) {
    toast('Opening printable report…')
  }
  openPrintableReport(payload)
}

function openPrintableReport(p) {
  const period = (p.period_start || p.period_end)
    ? `${p.period_start || '—'} to ${p.period_end || '—'}`
    : 'All recorded data (no period filter)'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CredLock Technical Support Report</title>
<style>
  body{font-family:system-ui,Segoe UI,sans-serif;color:#14201f;max-width:900px;margin:24px auto;padding:0 20px;line-height:1.5}
  .cover{background:linear-gradient(135deg,#0a2540,#0b6e75);color:#fff;padding:32px;border-radius:12px;margin-bottom:24px}
  .cover h1{margin:0 0 8px;font-size:1.6rem}
  .muted{color:#5d6b6a}
  h2{color:#0a2540;border-bottom:2px solid #0b6e75;padding-bottom:6px;margin-top:28px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{border:1px solid #dfe5e4;padding:8px 10px;text-align:left;font-size:13px}
  th{background:#f0f7f7}
  .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
  .kpi div{background:#f6f7f6;border:1px solid #dfe5e4;border-radius:8px;padding:12px;text-align:center}
  .kpi strong{display:block;font-size:1.4rem;color:#0b6e75}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="cover">
  <h1>CredLock Africa — Technical Support Management Report</h1>
  <p>Type: ${esc(p.report_type)} · Period: ${esc(period)}</p>
  <p style="opacity:.9;margin:0">Generated ${esc(p.generated_at)} · Figures from system records only</p>
</div>
<p class="no-print"><button onclick="window.print()">Print / Save as PDF</button></p>
<h2>1–2. Header &amp; reporting period</h2>
<p>Department: Technical Support · Report type: <strong>${esc(p.report_type)}</strong> · Period: <strong>${esc(period)}</strong></p>
<h2>3. Executive summary</h2>
<div class="kpi">
  <div><strong>${p.ticket_total}</strong>Tickets</div>
  <div><strong>${p.ticket_resolved}</strong>Resolved</div>
  <div><strong>${p.resolution_rate}%</strong>Resolution rate</div>
  <div><strong>${p.sla_breaches}</strong>SLA breaches</div>
</div>
<p>Open incidents: ${p.incidents_open} · Escalated tickets: ${p.escalated} · Active officers: ${p.officers_active} · KAVRO records: ${p.kavro_total} · Device ops: ${p.device_ops_total}</p>
<h2>4–6. Previous month</h2>
<p>Previous month performance / achievements / challenges: <em>Not Available</em> (select a date range with historical data loaded).</p>
<h2>7–8. Current period achievements &amp; challenges</h2>
<p>Achievements derived from resolved tickets and closed incidents when period filters are applied. Challenges: escalations ${p.escalated}, SLA breaches ${p.sla_breaches}.</p>
<h2>9–11. Ticket volume, trends, operational highlights</h2>
<p>Total tickets in system: ${p.ticket_total}. Resolution rate: ${p.resolution_rate}%. Weekly trend charts: <em>Not Available</em> without date-bucketed aggregates.</p>
<h2>12. KAVRO / FDX / device operations</h2>
<p>KAVRO enrollment records: ${p.kavro_total}. Device operations register: ${p.device_ops_total}.</p>
<h2>13–15. Incidents, KPI scorecard, SLA</h2>
<p>Open incidents: ${p.incidents_open}. SLA first-response targets (proposed): P1 5 min · P2 10 min · P3 30 min · P4 2 business hours. Breaches recorded: ${p.sla_breaches}. Acknowledgement is not resolution.</p>
<h2>16. Officer workload</h2>
<p>See Officers module in the live platform for per-officer assigned / resolved / pending / escalated and average response time.</p>
<h2>17–21. Outstanding issues, recommendations, action plan, owners, decisions</h2>
<p>Outstanding issues and recommendations: see Recommendations module. Next month action plan / management decisions required: <em>Not Recorded</em>.</p>
<h2>22. Conclusion</h2>
<p>This report is generated from live CredLock Technical Support records. Missing figures are marked Not Available or Not Recorded and are not invented.</p>
<p class="muted" style="margin-top:32px">CredLock Africa · Confidential · For executive and departmental review</p>
</body></html>`
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
  } else {
    toast('Allow pop-ups to open the printable report')
  }
}

// ─── Kavro Analytics ─────────────────────────────────────────
function kavroStats() {
  const total = kavro.length
  const resolved = kavro.filter(k => k.status === 'Resolved').length
  const open = total - resolved
  const qr = kavro.filter(k => k.issue_category === 'QR Code Error').length
  const apk = kavro.filter(k => k.issue_category === 'APK Install Error').length
  const cfg = kavro.filter(k => k.issue_category === 'Config Error').length
  const rate = total ? ((resolved / total) * 100).toFixed(1) + '%' : '—'
  const days = kavro.filter(k => k.turnaround_days != null).map(k => Number(k.turnaround_days))
  const avg = days.length ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1) + ' d' : '—'
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDow = {}
  daysOfWeek.forEach(d => { byDow[d] = { total: 0, resolved: 0 } })
  kavro.forEach(k => {
    if (!k.date_logged) return
    const d = new Date(k.date_logged + 'T12:00:00')
    const name = daysOfWeek[d.getDay()]
    byDow[name].total++
    if (k.status === 'Resolved') byDow[name].resolved++
  })
  return { total, resolved, open, qr, apk, cfg, rate, avg, byDow, daysOfWeek }
}

// ─── Dashboard / KPI ─────────────────────────────────────────
function viewDashboard() {
  const openStatuses = ['New', 'Assigned', 'In Progress', 'Pending', 'Escalated', 'Reopened', 'OPEN', 'IN_PROGRESS', 'WAITING']
  const closedStatuses = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED']
  const total = tickets.length
  const open = tickets.filter(t => openStatuses.includes(normalizeStatus(t.status)) || openStatuses.includes(t.status)).length
  const resolvedT = tickets.filter(t => closedStatuses.includes(normalizeStatus(t.status))).length
  const pending = tickets.filter(t => normalizeStatus(t.status) === 'Pending').length
  const reopened = tickets.filter(t => normalizeStatus(t.status) === 'Reopened').length
  const escalated = tickets.filter(t => t.escalated || normalizeStatus(t.status) === 'Escalated').length
  const critical = tickets.filter(t => {
    const p = String(t.priority || '')
    return (p.includes('P1') || p === 'Critical') && !closedStatuses.includes(normalizeStatus(t.status))
  }).length
  const assigned = tickets.filter(t => t.assigned_to || t.officer).length
  const breached = tickets.filter(isSlaBreached).length
  const approaching = tickets.filter(isSlaApproaching).length
  const frTimes = tickets.map(firstResponseMinutes).filter(x => x != null)
  const avgFr = frTimes.length ? Math.round(frTimes.reduce((a, b) => a + b, 0) / frTimes.length) : null
  const resolutionRate = total ? Math.round((resolvedT / total) * 100) : 0
  const s = kavroStats()
  const openRecs = recommendations.filter(r => r.status === 'Open' || r.status === 'In Progress').length
  const openInc = incidents.filter(i => !['Resolved', 'Closed'].includes(i.status)).length
  const critInc = incidents.filter(i => (i.severity === 'Critical' || i.severity === 'High') && !['Resolved', 'Closed'].includes(i.status)).length
  const opsOpen = deviceOps.filter(d => !['Resolved', 'Closed', 'Completed'].includes(d.status)).length
  const byCat = {}
  ISSUE_TYPES.forEach(c => { byCat[c] = 0 })
  tickets.forEach(t => {
    const c = t.issue_type || t.category || 'Other'
    byCat[c] = (byCat[c] || 0) + 1
  })

  return `
    <div class="card brand-header" style="margin-bottom:16px">
      <h3 style="margin:0">CredLock Technical Support — KPI Dashboard</h3>
      <p class="muted" style="margin:6px 0 0">
        Live metrics from system records. SLA targets (proposed): P1 5 min · P2 10 min · P3 30 min · P4 2 business hours first response.
        Acknowledgement is not resolution.
      </p>
    </div>

    <h4 class="section-label">Ticket performance</h4>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card tile kpi"><div class="v">${total}</div><div class="l">Total received</div></div>
      <div class="card tile kpi"><div class="v">${assigned}</div><div class="l">Assigned</div></div>
      <div class="card tile kpi"><div class="v ok">${resolvedT}</div><div class="l">Resolved / Closed</div></div>
      <div class="card tile kpi"><div class="v">${open}</div><div class="l">Open / Active</div></div>
      <div class="card tile kpi"><div class="v">${pending}</div><div class="l">Pending</div></div>
      <div class="card tile kpi"><div class="v">${reopened}</div><div class="l">Reopened</div></div>
      <div class="card tile kpi"><div class="v ${escalated ? 'bad' : ''}">${escalated}</div><div class="l">Escalated</div></div>
      <div class="card tile kpi"><div class="v ok">${resolutionRate}%</div><div class="l">Resolution rate</div></div>
    </div>

    <h4 class="section-label">Response &amp; SLA</h4>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card tile kpi"><div class="v">${avgFr != null ? avgFr + 'm' : 'N/A'}</div><div class="l">Avg first response</div></div>
      <div class="card tile kpi"><div class="v ${breached ? 'bad' : 'ok'}">${breached}</div><div class="l">SLA breaches</div></div>
      <div class="card tile kpi"><div class="v ${approaching ? 'warn' : ''}">${approaching}</div><div class="l">Approaching breach</div></div>
      <div class="card tile kpi"><div class="v ${critical ? 'bad' : ''}">${critical}</div><div class="l">P1 / Critical open</div></div>
    </div>

    <h4 class="section-label">Technical operations &amp; incidents</h4>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card tile kpi"><div class="v">${s.total}</div><div class="l">KAVRO logged</div></div>
      <div class="card tile kpi"><div class="v">${s.open}</div><div class="l">KAVRO open</div></div>
      <div class="card tile kpi"><div class="v">${opsOpen}</div><div class="l">Device ops open</div></div>
      <div class="card tile kpi"><div class="v ${critInc ? 'bad' : ''}">${openInc} / ${critInc}</div><div class="l">Incidents open / critical</div></div>
    </div>

    <div class="grid g4" style="margin-bottom:16px">
      <div class="card tile"><div class="v ok">${s.rate}</div><div class="l">Kavro resolution</div></div>
      <div class="card tile"><div class="v">${openRecs}</div><div class="l">Open recommendations</div></div>
      <div class="card tile"><div class="v">${profiles.filter(p => p.account_status === 'Active' && p.role === 'Officer').length}</div><div class="l">Active officers</div></div>
      <div class="card tile"><div class="v">${documents.length || 'N/A'}</div><div class="l">Documents on file</div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Kavro Enrollment — Fleet Health</h3>
      <div class="grid g4">
        <div class="tile"><div class="v">${s.qr}</div><div class="l">QR Code issues</div></div>
        <div class="tile"><div class="v">${s.apk}</div><div class="l">APK install errors</div></div>
        <div class="tile"><div class="v">${s.cfg}</div><div class="l">Config / battery</div></div>
        <div class="tile"><div class="v">${s.avg}</div><div class="l">Avg turnaround</div></div>
      </div>
      ${s.total ? `
        <div class="insight" style="margin-top:14px">
          <strong>Issue breakdown:</strong>
          QR ${(s.qr/s.total*100).toFixed(1)}% · APK ${(s.apk/s.total*100).toFixed(1)}% · Config ${(s.cfg/s.total*100).toFixed(1)}%.
          <br><strong>Status:</strong> ${s.total} logged · ${s.resolved} resolved · ${s.open} active · ${s.rate} resolution · ${s.avg} avg turnaround.
        </div>
      ` : ''}
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>Recent tickets</h3>
        <div class="tw">
          <table>
            <tr><th>No</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th></tr>
            ${tickets.slice(0, 8).map(t => `
              <tr class="click" onclick="window.__openTicket('${t.id}')">
                <td class="n">${esc(t.ticket_no)}</td>
                <td>${esc(t.title)}</td>
                <td>${esc(t.issue_type || t.category || '—')}</td>
                <td>${chipP(t.priority)}</td>
                <td>${esc(t.status)}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" class="empty">No tickets yet</td></tr>'}
          </table>
        </div>
      </div>
      <div class="card">
        <h3>Recent Kavro issues</h3>
        <div class="tw">
          <table>
            <tr><th>Date</th><th>IMEI</th><th>Category</th><th>Status</th></tr>
            ${kavro.slice(0, 8).map(k => `
              <tr class="click" onclick="window.__viewKavro('${k.id}')">
                <td class="n">${esc(fmtDay(k.date_logged))}</td>
                <td class="n">${esc(k.device_imei)}</td>
                <td>${esc(k.issue_category)}</td>
                <td>${chipS(k.status)}</td>
              </tr>
            `).join('') || '<tr><td colspan="4" class="empty">No issues yet</td></tr>'}
          </table>
        </div>
      </div>
    </div>
  `
}

// ─── Tickets ─────────────────────────────────────────────────
function viewTickets() {
  const q = ($('#fq')?.value || '').toLowerCase()
  const st = $('#fst')?.value || ''
  const pr = $('#fpr')?.value || ''
  const scope = $('#fscope')?.value || (isOfficer() && !isTeamLead() ? 'mine' : 'all')

  let filtered = tickets
  // Officers see only their assigned tickets by default; dept heads can filter by department
  if (scope === 'mine') filtered = filtered.filter(isAssignedToMe)
  else if (scope === 'dept' && isDeptHead()) filtered = filtered.filter(isMyDepartmentTicket)
  else if (isOfficer() && !isTeamLead() && !isSuperAdmin()) filtered = filtered.filter(isAssignedToMe)

  if (q) filtered = filtered.filter(t =>
    (t.title + t.ticket_no + (t.customer || '') + (t.officer || '') + (t.issue_type || '')).toLowerCase().includes(q)
  )
  if (st) filtered = filtered.filter(t => t.status === st)
  if (pr) filtered = filtered.filter(t => t.priority === pr)

  const unacked = filtered.filter(t => isAssignedToMe(t) && !t.acknowledged_at && !['RESOLVED', 'CLOSED'].includes(t.status)).length

  return `
    <div class="row" style="margin-bottom:12px">
      ${canWrite() ? '<button class="btn" id="create-ticket">+ New ticket</button>' : ''}
      <div class="sp"></div>
      ${unacked > 0 ? `<span class="chip y">${unacked} awaiting acknowledgement</span>` : ''}
      <span class="muted">${filtered.length} ticket(s)</span>
    </div>
    <div class="card">
      <div class="row">
        <input id="fq" placeholder="Search title, number, customer, type…" value="${esc(q)}" style="min-width:200px">
        <select id="fscope">
          ${(isOfficer() || isDeptHead()) ? `<option value="mine" ${scope==='mine'?'selected':''}>My assignments</option>` : ''}
          ${isDeptHead() ? `<option value="dept" ${scope==='dept'?'selected':''}>My department</option>` : ''}
          ${isTeamLead() || isSuperAdmin() ? `<option value="all" ${scope==='all'?'selected':''}>All tickets</option>` : ''}
          ${!(isOfficer() || isDeptHead()) ? `<option value="all" selected>All tickets</option>` : ''}
        </select>
        <select id="fst">
          <option value="">All statuses</option>
          ${STATUSES.map(s => `<option value="${s}" ${st === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="fpr">
          <option value="">All priorities</option>
          ${PRIOS.map(p => `<option value="${p}" ${pr === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        <button class="btn sec" id="apply-filters">Filter</button>
      </div>
      <div class="tw" style="margin-top:12px">
        <table>
          <tr>
            <th>No</th><th>Title</th><th>Issue type</th><th>Priority</th>
            <th>Status</th><th>SLA</th><th>Assigned</th><th>Ack</th><th>Created</th><th></th>
          </tr>
          ${filtered.length === 0 ? '<tr><td colspan="10" class="empty">No tickets found</td></tr>' :
            filtered.map(t => `
              <tr class="${isSlaBreached(t) ? 'row-breach' : isSlaApproaching(t) ? 'row-risk' : ''}">
                <td class="n">${esc(t.ticket_no)}</td>
                <td>${esc(t.title)}</td>
                <td>${esc(t.issue_type || t.category || '—')}</td>
                <td>${chipP(t.priority)}</td>
                <td>${chipS(normalizeStatus(t.status))}</td>
                <td>${slaBadge(t) || '—'}</td>
                <td>${esc(t.officer || '—')}</td>
                <td>${t.acknowledged_at ? chipS('Ack') : (isAssignedToMe(t) ? '<span class="chip y">New</span>' : '—')}</td>
                <td class="n">${fmtDate(t.created_at)}</td>
                <td class="actions">
                  <button class="btn sec sm" onclick="window.__openTicket('${t.id}')">Work</button>
                  ${canWrite() && (isAssignedToMe(t) || isTeamLead()) ? `<button class="btn sec sm" onclick="window.__editTicket('${t.id}')">Edit</button>` : ''}
                  ${canAssign() ? `<button class="btn sec sm" onclick="window.__assignTicket('${t.id}')">Assign</button>` : ''}
                  ${canDelete() ? `<button class="btn danger sm" onclick="window.__deleteTicket('${t.id}')">Delete</button>` : ''}
                </td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

window.__openTicket = (id) => {
  const t = tickets.find(x => x.id === id)
  if (!t) return
  const notes = (ticketNotes || []).filter(n => n.ticket_id === id).slice(0, 30)
  const mine = isAssignedToMe(t)
  const canAct = canWrite() && (mine || isTeamLead())
  const needsAck = mine && !t.acknowledged_at && !['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(normalizeStatus(t.status))
  const age = ticketAgeMinutes(t)
  const fr = firstResponseMinutes(t)
  const meta = priorityMeta(t.priority)

  showModal('Ticket ' + esc(t.ticket_no), `
    <div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap">
      ${chipP(t.priority)} ${chipS(normalizeStatus(t.status))} ${slaBadge(t)}
      <span class="muted">Age: ${age != null ? age + ' min' : '—'} · First response: ${fr != null ? fr + ' min' : 'Not recorded'} · Target: ${meta.minutes} min</span>
    </div>
    <div class="detail-row"><div class="label">Title</div><div class="value">${esc(t.title)}</div></div>
    <div class="detail-row"><div class="label">Issue type</div><div class="value">${esc(t.issue_type || t.category || '—')}</div></div>
    <div class="detail-row"><div class="label">Priority</div><div class="value">${chipP(t.priority)}</div></div>
    <div class="detail-row"><div class="label">Status</div><div class="value">${esc(t.status)}</div></div>
    <div class="detail-row"><div class="label">Assigned / Officer</div><div class="value">${esc(t.officer || '—')}</div></div>
    <div class="detail-row"><div class="label">Customer / Merchant</div><div class="value">${esc(t.customer || t.merchant_name || '—')}</div></div>
    <div class="detail-row"><div class="label">IMEI</div><div class="value mono">${esc(t.device_imei || '—')}</div></div>
    <div class="detail-row"><div class="label">Escalated</div><div class="value">${t.escalated ? 'Yes @ ' + fmtDate(t.escalated_at) : 'No'}</div></div>
    <div class="detail-row"><div class="label">Acknowledged</div><div class="value">${t.acknowledged_at ? fmtDate(t.acknowledged_at) : 'Not yet'}</div></div>
    <div class="detail-row"><div class="label">Description</div><div class="value">${esc(t.description || '—')}</div></div>
    <div class="detail-row"><div class="label">Investigation</div><div class="value">${esc(t.investigation_summary || '—')}</div></div>
    <div class="detail-row"><div class="label">Troubleshooting</div><div class="value">${esc(t.troubleshooting_steps || '—')}</div></div>
    <div class="detail-row"><div class="label">Resolution</div><div class="value">${esc(t.resolution_notes || '—')}</div></div>
    <div class="detail-row"><div class="label">Customer follow-up</div><div class="value">${esc(t.customer_followup || '—')}</div></div>
    <div class="detail-row"><div class="label">Merchant follow-up</div><div class="value">${esc(t.merchant_followup || '—')}</div></div>
    <div class="detail-row"><div class="label">Created</div><div class="value">${fmtDate(t.created_at)}</div></div>
    <h3 style="margin-top:16px">Investigation & notes</h3>
    <div class="tw">
      <table>
        <tr><th>Type</th><th>Note</th><th>By</th><th>When</th></tr>
        ${notes.length === 0 ? '<tr><td colspan="4" class="empty">No notes yet</td></tr>' :
          notes.map(n => `<tr><td>${esc(n.type)}</td><td>${esc(n.body)}</td><td>${esc(n.created_by || '—')}</td><td class="n">${fmtDate(n.created_at)}</td></tr>`).join('')}
      </table>
    </div>
  `, `
    ${needsAck ? `<button class="btn" id="ack-ticket">Acknowledge assignment</button>` : ''}
    ${canAct ? `
      <button class="btn sec" onclick="window.__ticketNote('${t.id}')">Add note</button>
      <button class="btn sec" onclick="window.__ticketStatus('${t.id}')">Update status</button>
      <button class="btn sec" onclick="window.__ticketInvestigate('${t.id}')">Investigation / steps</button>
      <button class="btn sec" onclick="window.__ticketEscalate('${t.id}')">Escalate</button>
      <button class="btn sec" onclick="window.__ticketResolve('${t.id}')">Record resolution</button>
      <button class="btn sec" onclick="window.__ticketEvidence('${t.id}')">Upload evidence</button>
      <button class="btn sec" onclick="window.__editTicket('${t.id}');closeModal()">Edit fields</button>
    ` : ''}
    ${canAssign() ? `<button class="btn sec" onclick="window.__assignTicket('${t.id}');closeModal()">Assign</button>` : ''}
    <button class="btn sec" onclick="closeModal()">Close</button>
  `)
  setTimeout(() => {
    const ackBtn = $('#ack-ticket')
    if (ackBtn) {
      ackBtn.onclick = async () => {
        const { error } = await supabase.from('tickets').update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: currentProfile?.id || null,
          status: t.status === 'OPEN' ? 'IN_PROGRESS' : t.status,
          updated_at: new Date().toISOString()
        }).eq('id', id)
        if (error) return toast(error.message)
        await logActivity('ticket.acknowledged', 'ticket', id, { ticket_no: t.ticket_no })
        await supabase.from('activity').insert({
          ticket_id: id,
          type: 'Status Change',
          body: 'Assignment acknowledged by officer',
          created_by: currentProfile?.full_name || currentUser?.email
        })
        toast('Assignment acknowledged')
        closeModal()
        await loadAllData()
        renderTab()
      }
    }
  }, 0)
}

window.__ticketNote = (id) => {
  const t = tickets.find(x => x.id === id)
  if (!t) return
  showModal('Add note — ' + esc(t.ticket_no), `
    <label>Note type</label>
    <select id="note_type" style="width:100%">
      <option>Internal Note</option>
      <option>Investigation</option>
      <option>Troubleshooting</option>
      <option>Customer Follow-up</option>
      <option>Merchant Follow-up</option>
    </select>
    <label style="margin-top:8px;display:block">Note</label>
    <textarea id="note_body" rows="4" style="width:100%" placeholder="Investigation findings, steps tried, customer conversation…"></textarea>
  `, `
    <button class="btn" id="save-note">Save note</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-note').onclick = async () => {
      const body = $('#note_body').value.trim()
      if (!body) return toast('Note required')
      const type = $('#note_type').value
      const { error } = await supabase.from('activity').insert({
        ticket_id: id,
        type,
        body,
        created_by: currentProfile?.full_name || currentUser?.email
      })
      if (error) return toast(error.message)
      // Mirror key fields onto ticket for quick view
      const patch = { updated_at: new Date().toISOString() }
      if (type === 'Customer Follow-up') patch.customer_followup = body
      if (type === 'Merchant Follow-up') patch.merchant_followup = body
      if (type === 'Investigation') patch.investigation_summary = body
      if (type === 'Troubleshooting') patch.troubleshooting_steps = body
      await supabase.from('tickets').update(patch).eq('id', id)
      await logActivity('ticket.note', 'ticket', id, { type })
      toast('Note saved')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__ticketStatus = (id) => {
  const t = tickets.find(x => x.id === id)
  if (!t) return
  showModal('Update status — ' + esc(t.ticket_no), `
    <label>Status</label>
    <select id="st_val" style="width:100%">
      ${STATUSES.map(s => `<option value="${s}" ${t.status===s?'selected':''}>${s}</option>`).join('')}
    </select>
    <label style="margin-top:8px;display:block">Comment (optional)</label>
    <textarea id="st_comment" rows="2" style="width:100%"></textarea>
  `, `
    <button class="btn" id="save-st">Update</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-st').onclick = async () => {
      const status = $('#st_val').value
      const comment = $('#st_comment').value.trim()
      const payload = { status, updated_at: new Date().toISOString() }
      if (status === 'RESOLVED' || status === 'CLOSED') payload.resolved_at = new Date().toISOString()
      const { error } = await supabase.from('tickets').update(payload).eq('id', id)
      if (error) return toast(error.message)
      await supabase.from('activity').insert({
        ticket_id: id,
        type: 'Status Change',
        body: `Status → ${status}${comment ? ': ' + comment : ''}`,
        created_by: currentProfile?.full_name || currentUser?.email
      })
      await logActivity('ticket.status', 'ticket', id, { status })
      toast('Status updated')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__ticketInvestigate = (id) => {
  const t = tickets.find(x => x.id === id)
  if (!t) return
  showModal('Investigation & troubleshooting — ' + esc(t.ticket_no), `
    <label>Investigation summary</label>
    <textarea id="inv_sum" rows="3" style="width:100%">${esc(t.investigation_summary || '')}</textarea>
    <label style="margin-top:8px;display:block">Troubleshooting steps</label>
    <textarea id="inv_steps" rows="4" style="width:100%" placeholder="1. …&#10;2. …">${esc(t.troubleshooting_steps || '')}</textarea>
  `, `
    <button class="btn" id="save-inv">Save</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-inv').onclick = async () => {
      const investigation_summary = $('#inv_sum').value.trim()
      const troubleshooting_steps = $('#inv_steps').value.trim()
      const { error } = await supabase.from('tickets').update({
        investigation_summary,
        troubleshooting_steps,
        updated_at: new Date().toISOString()
      }).eq('id', id)
      if (error) return toast(error.message)
      if (investigation_summary) {
        await supabase.from('activity').insert({
          ticket_id: id, type: 'Investigation', body: investigation_summary,
          created_by: currentProfile?.full_name || currentUser?.email
        })
      }
      if (troubleshooting_steps) {
        await supabase.from('activity').insert({
          ticket_id: id, type: 'Troubleshooting', body: troubleshooting_steps,
          created_by: currentProfile?.full_name || currentUser?.email
        })
      }
      await logActivity('ticket.investigation', 'ticket', id, null)
      toast('Investigation saved')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__ticketEscalate = (id) => {
  const t = tickets.find(x => x.id === id)
  if (!t) return
  const leads = profiles.filter(p => ['Team Lead', 'Super Admin'].includes(p.role) && p.account_status === 'Active')
  showModal('Escalate ticket — ' + esc(t.ticket_no), `
    <p class="muted">Escalate unresolved case to a Team Lead / Department Head.</p>
    <label>Escalate to</label>
    <select id="esc_to" style="width:100%">
      <option value="">— Select —</option>
      ${leads.map(p => `<option value="${esc(p.id)}">${esc(p.full_name)} (${esc(p.role)})</option>`).join('')}
    </select>
    <label style="margin-top:8px;display:block">Reason</label>
    <textarea id="esc_reason" rows="3" style="width:100%" placeholder="Why this needs escalation…"></textarea>
  `, `
    <button class="btn" id="do-esc">Escalate</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#do-esc').onclick = async () => {
      const to = $('#esc_to').value
      const reason = $('#esc_reason').value.trim()
      if (!reason) return toast('Reason required')
      const { error } = await supabase.from('tickets').update({
        escalated: true,
        escalated_at: new Date().toISOString(),
        escalated_to: to || null,
        escalation: reason,
        updated_at: new Date().toISOString()
      }).eq('id', id)
      if (error) return toast(error.message)
      await supabase.from('activity').insert({
        ticket_id: id, type: 'Escalation', body: reason,
        created_by: currentProfile?.full_name || currentUser?.email
      })
      await logActivity('ticket.escalated', 'ticket', id, { reason })
      toast('Ticket escalated')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__ticketResolve = (id) => {
  const t = tickets.find(x => x.id === id)
  if (!t) return
  showModal('Record resolution — ' + esc(t.ticket_no), `
    <label>Resolution details *</label>
    <textarea id="res_notes" rows="4" style="width:100%" placeholder="What fixed the issue, final outcome…">${esc(t.resolution_notes || '')}</textarea>
    <label style="margin-top:8px;display:block">Mark status</label>
    <select id="res_st" style="width:100%">
      <option value="RESOLVED">RESOLVED</option>
      <option value="CLOSED">CLOSED</option>
    </select>
  `, `
    <button class="btn" id="do-resolve">Save resolution</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#do-resolve').onclick = async () => {
      const resolution_notes = $('#res_notes').value.trim()
      if (!resolution_notes) return toast('Resolution details required')
      const status = $('#res_st').value
      const { error } = await supabase.from('tickets').update({
        resolution_notes,
        status,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', id)
      if (error) return toast(error.message)
      await supabase.from('activity').insert({
        ticket_id: id, type: 'Resolution', body: resolution_notes,
        created_by: currentProfile?.full_name || currentUser?.email
      })
      await logActivity('ticket.resolved', 'ticket', id, { status })
      toast('Resolution recorded')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__ticketEvidence = (id) => {
  const t = tickets.find(x => x.id === id)
  if (!t) return
  showModal('Upload evidence — ' + esc(t.ticket_no), `
    <p class="muted">Screenshots, logs, or other evidence. Files go to Supabase Storage bucket <code>reports</code> (or <code>evidence</code> if configured).</p>
    <label>Description</label>
    <input id="ev_desc" style="width:100%" placeholder="e.g. error screenshot, device log">
    <label style="margin-top:8px;display:block">File</label>
    <input type="file" id="ev_file" accept=".png,.jpg,.jpeg,.gif,.pdf,.txt,.log,.zip">
  `, `
    <button class="btn" id="do-ev">Upload</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#do-ev').onclick = async () => {
      const file = $('#ev_file')?.files?.[0]
      if (!file) return toast('Choose a file')
      const path = `tickets/${id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('reports').upload(path, file, { upsert: false })
      if (upErr) {
        // fallback: record metadata only if storage not configured
        toast('Storage upload failed: ' + upErr.message + ' — recording metadata only')
      }
      const { error } = await supabase.from('documents').insert({
        filename: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        entity_type: 'ticket',
        entity_id: id,
        uploaded_by: currentProfile?.id || null,
        description: $('#ev_desc').value.trim() || null
      })
      if (error) return toast(error.message)
      await supabase.from('activity').insert({
        ticket_id: id,
        type: 'Internal Note',
        body: `Evidence uploaded: ${file.name}`,
        created_by: currentProfile?.full_name || currentUser?.email
      })
      await logActivity('ticket.evidence', 'ticket', id, { filename: file.name })
      toast('Evidence recorded')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__editTicket = (id) => {
  const t = tickets.find(x => x.id === id)
  if (!t) return
  showModal('Edit ticket', `
    <div class="form-grid">
      <div class="full"><label>Title</label><input id="e_title" value="${esc(t.title)}" style="width:100%"></div>
      <div><label>Issue type</label><select id="e_type" style="width:100%">${ISSUE_TYPES.map(c => `<option ${ (t.issue_type||t.category)===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div><label>Priority</label><select id="e_pri" style="width:100%">${PRIOS.map(p => `<option ${t.priority===p?'selected':''}>${p}</option>`).join('')}</select></div>
      <div><label>Status</label><select id="e_st" style="width:100%">${STATUSES.map(s => `<option ${t.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div><label>Officer</label><input id="e_off" value="${esc(t.officer||'')}" style="width:100%"></div>
      <div><label>Customer / Merchant</label><input id="e_cust" value="${esc(t.customer||t.merchant_name||'')}" style="width:100%"></div>
      <div class="full"><label>IMEI</label><input id="e_imei" value="${esc(t.device_imei||'')}" style="width:100%"></div>
      <div class="full"><label>Description</label><textarea id="e_desc" rows="3" style="width:100%">${esc(t.description||'')}</textarea></div>
    </div>
  `, `
    <button class="btn" id="save-ticket">Save</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-ticket').onclick = async () => {
      const payload = {
        title: $('#e_title').value.trim(),
        issue_type: $('#e_type').value,
        category: $('#e_type').value,
        priority: $('#e_pri').value,
        status: $('#e_st').value,
        officer: $('#e_off').value.trim(),
        customer: $('#e_cust').value.trim(),
        device_imei: $('#e_imei').value.trim(),
        description: $('#e_desc').value.trim(),
        updated_at: new Date().toISOString()
      }
      const { error } = await supabase.from('tickets').update(payload).eq('id', id)
      if (error) return toast(error.message)
      await logActivity('ticket.updated', 'ticket', id, { title: payload.title })
      toast('Ticket updated')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__assignTicket = (id) => {
  if (!canAssign()) return toast('Only Team Leads / Super Admin can assign')
  const t = tickets.find(x => x.id === id)
  if (!t) return
  const officers = profiles.filter(p => ['Officer', 'Team Lead', 'Super Admin'].includes(p.role) && p.account_status === 'Active')
  showModal('Assign ticket', `
    <p class="muted">Assign <strong>${esc(t.ticket_no)}</strong> — ${esc(t.title)}. Officer must acknowledge the new assignment.</p>
    <label>Assign to</label>
    <select id="assign_to" style="width:100%">
      <option value="">— Select officer —</option>
      ${officers.map(p => `<option value="${esc(p.id)}" data-email="${esc(p.email)}" ${t.officer===p.email||t.assigned_to===p.id?'selected':''}>${esc(p.full_name)} (${esc(p.role)})</option>`).join('')}
    </select>
  `, `
    <button class="btn" id="do-assign">Assign</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#do-assign').onclick = async () => {
      const sel = $('#assign_to')
      const profileId = sel.value
      if (!profileId) return toast('Select an officer')
      const email = sel.selectedOptions[0]?.dataset?.email || officers.find(o => o.id === profileId)?.email
      const { error } = await supabase.from('tickets').update({
        officer: email,
        assigned_to: profileId,
        assigned_by: currentProfile?.id || null,
        assigned_at: new Date().toISOString(),
        acknowledged_at: null,
        acknowledged_by: null,
        updated_at: new Date().toISOString()
      }).eq('id', id)
      if (error) return toast(error.message)
      await supabase.from('activity').insert({
        ticket_id: id,
        type: 'Status Change',
        body: `Assigned to ${email}`,
        created_by: currentProfile?.full_name || currentUser?.email
      })
      await logActivity('ticket.assigned', 'ticket', id, { to: email })
      toast('Ticket assigned — officer must acknowledge')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__deleteTicket = async (id) => {
  if (!confirm('Delete this ticket permanently?')) return
  const { error } = await supabase.from('tickets').delete().eq('id', id)
  if (error) return toast(error.message)
  await logActivity('ticket.deleted', 'ticket', id, null)
  toast('Ticket deleted')
  await loadAllData()
  renderTab()
}

function openTicketForm() {
  showModal('New support ticket', `
    <div class="form-grid">
      <div style="grid-column:1/-1"><label>Title *</label><input id="n_title" style="width:100%" placeholder="Short summary"></div>
      <div><label>Issue category</label><select id="n_type" style="width:100%">${ISSUE_TYPES.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div><label>Priority</label><select id="n_pri" style="width:100%">${PRIOS.map(p => `<option ${p==='P3 Normal'?'selected':''}>${p}</option>`).join('')}</select></div>
      <div><label>Requester name</label><input id="n_cust" style="width:100%"></div>
      <div><label>Requester contact</label><input id="n_contact" style="width:100%"></div>
      <div><label>Requester type</label><select id="n_rtype" style="width:100%">${REQUESTER_TYPES.map(r => `<option>${r}</option>`).join('')}</select></div>
      <div><label>Source channel</label><select id="n_src" style="width:100%">${SOURCE_CHANNELS.map(s => `<option>${s}</option>`).join('')}</select></div>
      <div><label>Affected device / service</label><input id="n_device" style="width:100%"></div>
      <div><label>IMEI (if device-related)</label><input id="n_imei" style="width:100%"></div>
      <div style="grid-column:1/-1"><label>Issue description</label><textarea id="n_desc" rows="3" style="width:100%"></textarea></div>
      <div style="grid-column:1/-1"><label>Business impact</label><textarea id="n_impact" rows="2" style="width:100%"></textarea></div>
    </div>
  `, `
    <button class="btn" id="save-new-ticket">Create</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-new-ticket').onclick = async () => {
      const title = $('#n_title').value.trim()
      if (!title) return toast('Title is required')
      const ticket_no = 'TKT-' + Date.now().toString().slice(-6)
      const issue_type = $('#n_type').value
      const pri = $('#n_pri').value
      const meta = priorityMeta(pri)
      const { data, error } = await supabase.from('tickets').insert({
        ticket_no,
        title,
        issue_type,
        category: issue_type,
        priority: pri,
        priority_code: meta.code,
        sla_first_response_target_minutes: meta.minutes,
        status: 'New',
        officer: currentUser.email,
        assigned_to: currentProfile?.id || null,
        customer: $('#n_cust').value.trim(),
        requester_name: $('#n_cust').value.trim(),
        requester_contact: $('#n_contact')?.value?.trim() || null,
        requester_type: $('#n_rtype')?.value || null,
        source_channel: $('#n_src')?.value || null,
        affected_device_or_service: $('#n_device')?.value?.trim() || null,
        device_imei: $('#n_imei').value.trim(),
        description: $('#n_desc').value.trim(),
        business_impact: $('#n_impact')?.value?.trim() || null,
        created_by: currentUser.email
      }).select('id').single()
      if (error) return toast(error.message)
      await logActivity('ticket.created', 'ticket', data?.id, { ticket_no, title })
      try {
        await supabase.from('ticket_history').insert({
          ticket_id: data.id,
          actor_id: currentProfile?.id,
          actor_email: currentUser.email,
          change_type: 'status',
          new_value: 'New',
          details: { action: 'created' }
        })
      } catch (_) {}
      toast('Ticket created')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

// ─── Kavro Enrollment ────────────────────────────────────────
function viewKavro() {
  const s = kavroStats()
  let filtered = kavro
  if (kavroFilters.q) {
    const q = kavroFilters.q.toLowerCase()
    filtered = filtered.filter(k =>
      (k.device_imei + k.device_model + k.officer + k.error_notes + k.issue_category).toLowerCase().includes(q)
    )
  }
  if (kavroFilters.status) filtered = filtered.filter(k => k.status === kavroFilters.status)
  if (kavroFilters.category) filtered = filtered.filter(k => k.issue_category === kavroFilters.category)

  return `
    <div class="card" style="margin-bottom:16px">
      <h3>KAVRO DEVICE ENROLLMENT ISSUE TRACKER</h3>
      <div class="grid g4">
        <div class="tile"><div class="v">${s.total}</div><div class="l">Total logged</div></div>
        <div class="tile"><div class="v">${s.qr}</div><div class="l">QR Code issues</div></div>
        <div class="tile"><div class="v">${s.apk}</div><div class="l">APK install errors</div></div>
        <div class="tile"><div class="v">${s.open}</div><div class="l">Active / open</div></div>
      </div>
      <div class="grid g3" style="margin-top:10px">
        <div class="tile"><div class="v ok">${s.rate}</div><div class="l">Resolution rate</div></div>
        <div class="tile"><div class="v">${s.avg}</div><div class="l">Avg turnaround</div></div>
        <div class="tile"><div class="v">${s.cfg}</div><div class="l">Config errors</div></div>
      </div>
    </div>

    <div class="grid g2" style="margin-bottom:16px">
      <div class="card">
        <h3>By day of week</h3>
        <div class="tw">
          <table>
            <tr><th>Day</th><th class="n">Logged</th><th class="n">Resolved</th><th class="n">Rate</th><th class="n">Share</th></tr>
            ${s.daysOfWeek.map(d => {
              const r = s.byDow[d]
              const rate = r.total ? ((r.resolved/r.total)*100).toFixed(1)+'%' : '—'
              const share = s.total ? ((r.total/s.total)*100).toFixed(1)+'%' : '—'
              return `<tr><td>${d}</td><td class="n">${r.total}</td><td class="n">${r.resolved}</td><td class="n">${rate}</td><td class="n">${share}</td></tr>`
            }).join('')}
          </table>
        </div>
      </div>
      <div class="card">
        <h3>Fleet health insights</h3>
        <div class="insight">
          <strong>Peak activity:</strong> ${(() => {
            const sorted = [...s.daysOfWeek].sort((a,b) => s.byDow[b].total - s.byDow[a].total)
            return sorted.slice(0,2).map(d => `${d} (${s.total?((s.byDow[d].total/s.total)*100).toFixed(1):0}%)`).join(' and ')
          })()}.
        </div>
        <div class="insight">
          <strong>Issue breakdown:</strong>
          QR ${s.total?((s.qr/s.total)*100).toFixed(1):0}% ·
          APK ${s.total?((s.apk/s.total)*100).toFixed(1):0}% ·
          Config ${s.total?((s.cfg/s.total)*100).toFixed(1):0}%.
        </div>
        <div class="insight">
          <strong>Status:</strong> ${s.total} logged · ${s.resolved} resolved · ${s.open} active · ${s.rate} · ${s.avg} avg.
        </div>
      </div>
    </div>

    <div class="row" style="margin-bottom:12px">
      ${canWrite() ? '<button class="btn" id="create-kavro">+ Log issue</button>' : ''}
      <div class="sp"></div>
    </div>
    <div class="card">
      <div class="row">
        <input id="kq" placeholder="Search IMEI, model, officer, error…" value="${esc(kavroFilters.q)}" style="min-width:200px">
        <select id="kst">
          <option value="">All statuses</option>
          ${KAV_STATUSES.map(s => `<option value="${s}" ${kavroFilters.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <select id="kct">
          <option value="">All categories</option>
          ${KAV_CATS.map(c => `<option value="${c}" ${kavroFilters.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <button class="btn sec" id="apply-kav-filters">Filter</button>
      </div>
      <div class="tw" style="margin-top:12px">
        <table>
          <tr>
            <th>Date</th><th>IMEI</th><th>Model</th><th>Officer</th>
            <th>Category</th><th>Status</th><th>Priority</th><th>Turnaround</th><th></th>
          </tr>
          ${filtered.length === 0 ? '<tr><td colspan="9" class="empty">No enrollment issues found</td></tr>' :
            filtered.map(k => `
              <tr>
                <td class="n">${esc(fmtDay(k.date_logged))}</td>
                <td class="n mono">${esc(k.device_imei)}</td>
                <td>${esc(k.device_model)}</td>
                <td>${esc(k.officer)}</td>
                <td>${esc(k.issue_category)}</td>
                <td>${chipS(k.status)}</td>
                <td>${chipP(k.priority)}</td>
                <td class="n">${k.turnaround_days != null ? k.turnaround_days + ' d' : '—'}</td>
                <td class="actions">
                  <button class="btn sec sm" onclick="window.__viewKavro('${k.id}')">View</button>
                  ${canWrite() ? `<button class="btn sec sm" onclick="window.__editKavro('${k.id}')">Edit</button>` : ''}
                  ${canDelete() ? `<button class="btn danger sm" onclick="window.__deleteKavro('${k.id}')">Delete</button>` : ''}
                </td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

window.__viewKavro = (id) => {
  const k = kavro.find(x => x.id === id)
  if (!k) return
  showModal('Kavro enrollment issue', `
    <div class="detail-row"><div class="label">Date logged</div><div class="value">${esc(fmtDay(k.date_logged))}</div></div>
    <div class="detail-row"><div class="label">Device IMEI</div><div class="value mono">${esc(k.device_imei)}</div></div>
    <div class="detail-row"><div class="label">Device model</div><div class="value">${esc(k.device_model)}</div></div>
    <div class="detail-row"><div class="label">Officer / Agent</div><div class="value">${esc(k.officer)}</div></div>
    <div class="detail-row"><div class="label">Issue category</div><div class="value">${esc(k.issue_category)}</div></div>
    <div class="detail-row"><div class="label">Status</div><div class="value">${chipS(k.status)}</div></div>
    <div class="detail-row"><div class="label">Priority</div><div class="value">${chipP(k.priority)}</div></div>
    <div class="detail-row"><div class="label">Resolution date</div><div class="value">${esc(fmtDay(k.resolution_date))}</div></div>
    <div class="detail-row"><div class="label">Turnaround</div><div class="value">${k.turnaround_days != null ? k.turnaround_days + ' d' : '—'}</div></div>
    <div class="detail-row"><div class="label">Error notes</div><div class="value">${esc(k.error_notes || '—')}</div></div>
    <div class="detail-row"><div class="label">Action taken</div><div class="value">${esc(k.action_taken || '—')}</div></div>
    <div class="detail-row"><div class="label">Additional notes</div><div class="value">${esc(k.additional_notes || '—')}</div></div>
  `, canWrite() ? `
    <button class="btn" onclick="window.__editKavro('${k.id}');closeModal()">Edit</button>
    <button class="btn sec" onclick="closeModal()">Close</button>
  ` : `<button class="btn sec" onclick="closeModal()">Close</button>`)
}

window.__editKavro = (id) => {
  const k = kavro.find(x => x.id === id)
  if (!k) return
  showModal('Edit Kavro issue', `
    <div class="form-grid">
      <div><label>Date logged</label><input type="date" id="k_date" value="${esc(fmtDay(k.date_logged))}" style="width:100%"></div>
      <div><label>IMEI</label><input id="k_imei" value="${esc(k.device_imei||'')}" style="width:100%"></div>
      <div><label>Device model</label><input id="k_model" value="${esc(k.device_model||'')}" style="width:100%"></div>
      <div><label>Officer / Agent</label><input id="k_off" value="${esc(k.officer||'')}" style="width:100%"></div>
      <div><label>Category</label><select id="k_cat" style="width:100%">${KAV_CATS.map(c => `<option ${k.issue_category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div><label>Status</label><select id="k_st" style="width:100%">${KAV_STATUSES.map(s => `<option ${k.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div><label>Priority</label><select id="k_pri" style="width:100%">${PRIOS.map(p => `<option ${k.priority===p?'selected':''}>${p}</option>`).join('')}</select></div>
      <div><label>Resolution date</label><input type="date" id="k_res" value="${esc(fmtDay(k.resolution_date))}" style="width:100%"></div>
      <div class="full"><label>Error notes</label><textarea id="k_err" rows="2" style="width:100%">${esc(k.error_notes||'')}</textarea></div>
      <div class="full"><label>Action taken</label><textarea id="k_act" rows="2" style="width:100%">${esc(k.action_taken||'')}</textarea></div>
      <div class="full"><label>Additional notes</label><textarea id="k_add" rows="2" style="width:100%">${esc(k.additional_notes||'')}</textarea></div>
    </div>
  `, `
    <button class="btn" id="save-kavro">Save</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-kavro').onclick = async () => {
      const dateLogged = $('#k_date').value
      const resDate = $('#k_res').value || null
      let turnaround = null
      if (dateLogged && resDate) {
        turnaround = Math.max(0, Math.round((new Date(resDate) - new Date(dateLogged)) / 864e5))
      }
      const { error } = await supabase.from('kavro_enrollment').update({
        date_logged: dateLogged,
        device_imei: $('#k_imei').value.trim(),
        device_model: $('#k_model').value.trim(),
        officer: $('#k_off').value.trim(),
        issue_category: $('#k_cat').value,
        status: $('#k_st').value,
        priority: $('#k_pri').value,
        resolution_date: resDate,
        turnaround_days: turnaround,
        error_notes: $('#k_err').value.trim(),
        action_taken: $('#k_act').value.trim(),
        additional_notes: $('#k_add').value.trim()
      }).eq('id', id)
      if (error) return toast(error.message)
      toast('Issue updated')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__deleteKavro = async (id) => {
  if (!confirm('Delete this enrollment issue permanently?')) return
  const { error } = await supabase.from('kavro_enrollment').delete().eq('id', id)
  if (error) return toast(error.message)
  toast('Issue deleted')
  await loadAllData()
  renderTab()
}

function openKavroForm() {
  showModal('Log Kavro enrollment issue', `
    <div class="form-grid">
      <div><label>Date logged</label><input type="date" id="nk_date" value="${new Date().toISOString().slice(0,10)}" style="width:100%"></div>
      <div><label>IMEI *</label><input id="nk_imei" style="width:100%" placeholder="15-digit IMEI"></div>
      <div><label>Device model</label><input id="nk_model" style="width:100%"></div>
      <div><label>Officer / Agent</label><input id="nk_off" value="${esc(currentProfile?.full_name || currentUser.email)}" style="width:100%"></div>
      <div><label>Category</label><select id="nk_cat" style="width:100%">${KAV_CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div><label>Status</label><select id="nk_st" style="width:100%">${KAV_STATUSES.map(s => `<option ${s==='In Progress'?'selected':''}>${s}</option>`).join('')}</select></div>
      <div><label>Priority</label><select id="nk_pri" style="width:100%">${PRIOS.map(p => `<option ${p==='Medium'?'selected':''}>${p}</option>`).join('')}</select></div>
      <div><label>Resolution date</label><input type="date" id="nk_res" style="width:100%"></div>
      <div class="full"><label>Error notes</label><textarea id="nk_err" rows="2" style="width:100%"></textarea></div>
      <div class="full"><label>Action taken</label><textarea id="nk_act" rows="2" style="width:100%"></textarea></div>
      <div class="full"><label>Additional notes</label><textarea id="nk_add" rows="2" style="width:100%"></textarea></div>
    </div>
  `, `
    <button class="btn" id="save-new-kavro">Create</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-new-kavro').onclick = async () => {
      const imei = $('#nk_imei').value.trim()
      if (!imei) return toast('IMEI is required')
      const dateLogged = $('#nk_date').value
      const resDate = $('#nk_res').value || null
      let turnaround = null
      if (dateLogged && resDate) {
        turnaround = Math.max(0, Math.round((new Date(resDate) - new Date(dateLogged)) / 864e5))
      }
      const { error } = await supabase.from('kavro_enrollment').insert({
        date_logged: dateLogged,
        device_imei: imei,
        device_model: $('#nk_model').value.trim(),
        officer: $('#nk_off').value.trim(),
        issue_category: $('#nk_cat').value,
        status: $('#nk_st').value,
        priority: $('#nk_pri').value,
        resolution_date: resDate,
        turnaround_days: turnaround,
        error_notes: $('#nk_err').value.trim(),
        action_taken: $('#nk_act').value.trim(),
        additional_notes: $('#nk_add').value.trim()
      })
      if (error) return toast(error.message)
      toast('Issue logged')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

// ─── Users (Super Admin / Team Lead) ─────────────────────────
function viewUsers() {
  if (!isTeamLead()) return '<div class="card empty">Access restricted</div>'
  return `
    <div class="row" style="margin-bottom:12px">
      ${canManageUsers() ? '<button class="btn" id="add-user-hint">+ Add user</button>' : ''}
      <div class="sp"></div>
      <span class="muted">${profiles.length} user(s) · Manage in Supabase Auth + profiles table</span>
    </div>
    <div class="card">
      <h3>Users & account status</h3>
      <p class="muted" style="margin-top:0">
        Super Admin can activate, deactivate or suspend accounts. Every status change is audited (who, when, reason).
        Create the Auth user in Supabase → Authentication, then insert a matching row in <code>profiles</code>.
      </p>
      <div class="tw" style="margin-top:12px">
        <table>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th></th></tr>
          ${profiles.length === 0 ? '<tr><td colspan="6" class="empty">No profiles yet. Run migration 003 and create users.</td></tr>' :
            profiles.map(p => `
              <tr>
                <td>${esc(p.full_name)}</td>
                <td>${esc(p.email)}</td>
                <td><span class="chip b">${esc(p.role)}</span></td>
                <td>${esc(p.departments?.name || '—')}</td>
                <td>${chipS(p.account_status || 'Active')}</td>
                <td class="actions">
                  ${canManageUsers() ? `
                    <button class="btn sec sm" onclick="window.__changeStatus('${p.id}','Active')">Activate</button>
                    <button class="btn sec sm" onclick="window.__changeStatus('${p.id}','Inactive')">Deactivate</button>
                    <button class="btn danger sm" onclick="window.__changeStatus('${p.id}','Suspended')">Suspend</button>
                    <button class="btn sec sm" onclick="window.__changeRole('${p.id}')">Role</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

window.__changeStatus = async (profileId, newStatus) => {
  if (!canManageUsers()) return
  const reason = prompt(`Reason for setting status to ${newStatus}:`)
  if (reason === null) return
  const p = profiles.find(x => x.id === profileId)
  const old = p?.account_status
  const { error } = await supabase.from('profiles').update({
    account_status: newStatus,
    status_reason: reason || null,
    status_changed_at: new Date().toISOString(),
    status_changed_by: currentProfile?.id || null,
    updated_at: new Date().toISOString()
  }).eq('id', profileId)
  if (error) return toast(error.message)
  await supabase.from('account_status_log').insert({
    profile_id: profileId,
    old_status: old,
    new_status: newStatus,
    reason: reason || null,
    changed_by: currentProfile?.id || null
  })
  await logActivity('user.status_changed', 'profile', profileId, { old, new: newStatus, reason })
  toast(`Status set to ${newStatus}`)
  await loadAllData()
  renderTab()
}

window.__changeRole = async (profileId) => {
  if (!canManageUsers()) return
  const p = profiles.find(x => x.id === profileId)
  showModal('Change role — ' + esc(p?.full_name || ''), `
    <label>Role</label>
    <select id="new_role" style="width:100%">
      ${ROLES.map(r => `<option value="${r}" ${p?.role===r?'selected':''}>${r}</option>`).join('')}
    </select>
  `, `
    <button class="btn" id="save-role">Save</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-role').onclick = async () => {
      const role = $('#new_role').value
      const { error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', profileId)
      if (error) return toast(error.message)
      await logActivity('user.role_changed', 'profile', profileId, { role })
      toast('Role updated')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

// ─── Departments (Super Admin) ───────────────────────────────
function viewDepartments() {
  if (!canManageDepartments()) return '<div class="card empty">Access restricted to Super Admin</div>'
  const headName = (hid) => {
    const p = profiles.find(x => x.id === hid)
    return p ? p.full_name : '—'
  }
  const officersOf = (deptId) => profiles.filter(p => p.department_id === deptId)
  const hist = (deptId) => (departmentActivity || []).filter(a => a.department_id === deptId).slice(0, 5)

  return `
    <div class="row" style="margin-bottom:12px">
      <button class="btn" id="add-dept">+ Department</button>
      <div class="sp"></div>
      <span class="muted">Add departments without code changes. Suggested: Technical Support, Customer Service, Collections, Recovery, Merchant Relations, Merchant Acquisition, Enrollment, Risk and Compliance, Loan Approval, Finance, Engineering / IT.</span>
    </div>
    <div class="card">
      <h3>Department management</h3>
      <div class="tw">
        <table>
          <tr>
            <th>Name</th><th>Code</th><th>Description</th><th>Head</th>
            <th>Officers</th><th>Status</th><th>Created</th><th></th>
          </tr>
          ${departments.length === 0 ? '<tr><td colspan="8" class="empty">No departments. Run migrations 003 & 004.</td></tr>' :
            departments.map(d => `
              <tr>
                <td>${esc(d.name)}</td>
                <td class="n">${esc(d.code || '—')}</td>
                <td>${esc(d.description || '—')}</td>
                <td>${esc(headName(d.head_user_id))}</td>
                <td>${officersOf(d.id).length}</td>
                <td>${d.active ? chipS('Active') : chipS('Inactive')}</td>
                <td class="n">${fmtDay(d.created_at)}</td>
                <td class="actions">
                  <button class="btn sec sm" onclick="window.__editDept('${d.id}')">Edit</button>
                  <button class="btn sec sm" onclick="window.__deptHistory('${d.id}')">History</button>
                </td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

function openDeptForm() {
  if (!canManageDepartments()) return toast('Restricted')
  const heads = profiles.filter(p => ['Team Lead', 'Super Admin', 'Officer'].includes(p.role) && p.account_status === 'Active')
  showModal('New department', `
    <div class="form-grid">
      <div><label>Name *</label><input id="d_name" style="width:100%" placeholder="e.g. Technical Support"></div>
      <div><label>Code</label><input id="d_code" style="width:100%" placeholder="e.g. TS"></div>
      <div class="full"><label>Description</label><textarea id="d_desc" rows="2" style="width:100%"></textarea></div>
      <div class="full"><label>Department head</label>
        <select id="d_head" style="width:100%">
          <option value="">— None —</option>
          ${heads.map(p => `<option value="${esc(p.id)}">${esc(p.full_name)} (${esc(p.role)})</option>`).join('')}
        </select>
      </div>
    </div>
  `, `
    <button class="btn" id="save-dept">Create</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-dept').onclick = async () => {
      const name = $('#d_name').value.trim()
      if (!name) return toast('Name required')
      const head_user_id = $('#d_head').value || null
      const { data, error } = await supabase.from('departments').insert({
        name,
        code: $('#d_code').value.trim() || null,
        description: $('#d_desc').value.trim() || null,
        head_user_id
      }).select('id').single()
      if (error) return toast(error.message)
      await logActivity('department.created', 'department', data?.id, { name })
      if (data?.id) {
        await supabase.from('department_activity').insert({
          department_id: data.id,
          actor_id: currentProfile?.id || null,
          actor_email: currentUser?.email || null,
          action: 'created',
          details: { name, head_user_id }
        })
      }
      toast('Department created')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__editDept = (id) => {
  if (!canManageDepartments()) return toast('Restricted')
  const d = departments.find(x => x.id === id)
  if (!d) return
  const heads = profiles.filter(p => ['Team Lead', 'Super Admin', 'Officer'].includes(p.role) && p.account_status === 'Active')
  const officers = profiles.filter(p => p.account_status === 'Active')
  showModal('Edit department — ' + esc(d.name), `
    <div class="form-grid">
      <div><label>Name</label><input id="d_name" value="${esc(d.name)}" style="width:100%"></div>
      <div><label>Code</label><input id="d_code" value="${esc(d.code||'')}" style="width:100%"></div>
      <div class="full"><label>Description</label><textarea id="d_desc" rows="2" style="width:100%">${esc(d.description||'')}</textarea></div>
      <div><label>Status</label>
        <select id="d_active" style="width:100%">
          <option value="true" ${d.active?'selected':''}>Active</option>
          <option value="false" ${!d.active?'selected':''}>Inactive</option>
        </select>
      </div>
      <div><label>Department head</label>
        <select id="d_head" style="width:100%">
          <option value="">— None —</option>
          ${heads.map(p => `<option value="${esc(p.id)}" ${d.head_user_id===p.id?'selected':''}>${esc(p.full_name)}</option>`).join('')}
        </select>
      </div>
      <div class="full"><label>Assign officers to this department</label>
        <select id="d_officers" multiple size="6" style="width:100%">
          ${officers.map(p => `<option value="${esc(p.id)}" ${p.department_id===d.id?'selected':''}>${esc(p.full_name)} (${esc(p.role)})</option>`).join('')}
        </select>
        <p class="muted" style="margin-top:4px">Hold Ctrl/Cmd to multi-select. Selected officers are assigned to this department.</p>
      </div>
    </div>
  `, `
    <button class="btn" id="save-dept-edit">Save</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-dept-edit').onclick = async () => {
      const active = $('#d_active').value === 'true'
      const head_user_id = $('#d_head').value || null
      const { error } = await supabase.from('departments').update({
        name: $('#d_name').value.trim(),
        code: $('#d_code').value.trim() || null,
        description: $('#d_desc').value.trim() || null,
        active,
        head_user_id,
        updated_at: new Date().toISOString()
      }).eq('id', id)
      if (error) return toast(error.message)

      // Assign selected officers to this department; clear those previously on this dept but deselected
      const selected = Array.from($('#d_officers').selectedOptions).map(o => o.value)
      const previously = profiles.filter(p => p.department_id === id).map(p => p.id)
      for (const oid of selected) {
        if (!previously.includes(oid)) {
          await supabase.from('profiles').update({ department_id: id, updated_at: new Date().toISOString() }).eq('id', oid)
        }
      }
      for (const oid of previously) {
        if (!selected.includes(oid)) {
          await supabase.from('profiles').update({ department_id: null, updated_at: new Date().toISOString() }).eq('id', oid)
        }
      }

      await supabase.from('department_activity').insert({
        department_id: id,
        actor_id: currentProfile?.id || null,
        actor_email: currentUser?.email || null,
        action: active ? (d.active ? 'updated' : 'activated') : 'deactivated',
        details: { head_user_id, officers: selected.length }
      })
      await logActivity('department.updated', 'department', id, { name: $('#d_name').value.trim() })
      toast('Department updated')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__deptHistory = (id) => {
  const d = departments.find(x => x.id === id)
  if (!d) return
  const rows = (departmentActivity || []).filter(a => a.department_id === id)
  showModal('Activity history — ' + esc(d.name), `
    <div class="tw">
      <table>
        <tr><th>When</th><th>Action</th><th>By</th><th>Details</th></tr>
        ${rows.length === 0 ? '<tr><td colspan="4" class="empty">No history yet</td></tr>' :
          rows.map(a => `
            <tr>
              <td class="n">${fmtDate(a.created_at)}</td>
              <td>${esc(a.action)}</td>
              <td>${esc(a.actor_email || '—')}</td>
              <td class="n">${esc(a.details ? JSON.stringify(a.details) : '—')}</td>
            </tr>
          `).join('')}
      </table>
    </div>
  `, `<button class="btn sec" onclick="closeModal()">Close</button>`)
}

// ─── Recommendations (Team Lead+) ────────────────────────────
function viewRecommendations() {
  return `
    <div class="row" style="margin-bottom:12px">
      ${isTeamLead() ? '<button class="btn" id="add-rec">+ Recommendation</button>' : ''}
      <div class="sp"></div>
    </div>
    <div class="card">
      <h3>Management recommendations & action tracking</h3>
      <div class="tw">
        <table>
          <tr><th>Title</th><th>Status</th><th>Priority</th><th>Source</th><th>Due</th><th></th></tr>
          ${recommendations.length === 0 ? '<tr><td colspan="6" class="empty">No recommendations yet</td></tr>' :
            recommendations.map(r => `
              <tr>
                <td>${esc(r.title)}</td>
                <td>${chipS(r.status)}</td>
                <td>${chipP(r.priority || 'Medium')}</td>
                <td>${esc(r.source || '—')}</td>
                <td class="n">${esc(fmtDay(r.due_date))}</td>
                <td class="actions">
                  ${isTeamLead() ? `<button class="btn sec sm" onclick="window.__editRec('${r.id}')">Update</button>` : ''}
                </td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

function openRecForm() {
  showModal('New recommendation', `
    <div class="form-grid">
      <div class="full"><label>Title *</label><input id="r_title" style="width:100%"></div>
      <div class="full"><label>Details</label><textarea id="r_body" rows="3" style="width:100%"></textarea></div>
      <div><label>Priority</label><select id="r_pri" style="width:100%">${PRIOS.map(p => `<option>${p}</option>`).join('')}</select></div>
      <div><label>Source</label><select id="r_src" style="width:100%"><option>Team Lead</option><option>Management</option><option>Audit</option></select></div>
      <div><label>Due date</label><input type="date" id="r_due" style="width:100%"></div>
    </div>
  `, `
    <button class="btn" id="save-rec">Create</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-rec').onclick = async () => {
      const title = $('#r_title').value.trim()
      if (!title) return toast('Title required')
      const { error } = await supabase.from('recommendations').insert({
        title,
        body: $('#r_body').value.trim(),
        priority: $('#r_pri').value,
        source: $('#r_src').value,
        due_date: $('#r_due').value || null,
        status: 'Open',
        created_by: currentProfile?.id || null
      })
      if (error) return toast(error.message)
      toast('Recommendation recorded')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

window.__editRec = (id) => {
  const r = recommendations.find(x => x.id === id)
  if (!r) return
  showModal('Update recommendation', `
    <div class="form-grid">
      <div class="full"><label>Title</label><input id="r_title" value="${esc(r.title)}" style="width:100%"></div>
      <div class="full"><label>Details</label><textarea id="r_body" rows="3" style="width:100%">${esc(r.body||'')}</textarea></div>
      <div><label>Status</label><select id="r_st" style="width:100%">
        ${['Open','In Progress','Completed','Closed'].map(s => `<option ${r.status===s?'selected':''}>${s}</option>`).join('')}
      </select></div>
      <div><label>Priority</label><select id="r_pri" style="width:100%">${PRIOS.map(p => `<option ${r.priority===p?'selected':''}>${p}</option>`).join('')}</select></div>
      <div><label>Due date</label><input type="date" id="r_due" value="${esc(fmtDay(r.due_date))}" style="width:100%"></div>
    </div>
  `, `
    <button class="btn" id="save-rec-edit">Save</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-rec-edit').onclick = async () => {
      const status = $('#r_st').value
      const { error } = await supabase.from('recommendations').update({
        title: $('#r_title').value.trim(),
        body: $('#r_body').value.trim(),
        status,
        priority: $('#r_pri').value,
        due_date: $('#r_due').value || null,
        completed_at: status === 'Completed' || status === 'Closed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }).eq('id', id)
      if (error) return toast(error.message)
      toast('Recommendation updated')
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

// ─── Activity log (Super Admin) ──────────────────────────────
function viewActivity() {
  if (!isSuperAdmin()) return '<div class="card empty">Access restricted</div>'
  return `
    <div class="card">
      <h3>System-wide activity log</h3>
      <div class="tw">
        <table>
          <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr>
          ${systemActivity.length === 0 ? '<tr><td colspan="5" class="empty">No activity recorded yet</td></tr>' :
            systemActivity.map(a => `
              <tr>
                <td class="n">${fmtDate(a.created_at)}</td>
                <td>${esc(a.actor_email || '—')}</td>
                <td>${esc(a.action)}</td>
                <td>${esc(a.entity_type || '—')}</td>
                <td class="muted">${esc(a.details ? JSON.stringify(a.details) : '')}</td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

// ─── Incidents / Reports / Team / Officer tools ──────────────
function viewIncidents() {
  return `
    <div class="row" style="margin-bottom:12px">
      ${canWrite() ? '<button class="btn" id="add-incident">+ Technical incident</button>' : ''}
      <div class="sp"></div>
      <span class="muted">${incidents.length} incident(s) · notes are timestamped and retained</span>
    </div>
    <div class="card">
      <h3>Incident Management</h3>
      <p class="muted">Unique reference, severity, impact, root cause, investigation, escalation and closure. Add timeline notes without overwriting history.</p>
      <div class="tw">
        <table>
          <tr><th>Ref</th><th>Title</th><th>Category</th><th>Severity</th><th>Status</th><th>Discovered</th><th></th></tr>
          ${incidents.length === 0 ? '<tr><td colspan="7" class="empty">No incidents</td></tr>' :
            incidents.map(i => `
              <tr>
                <td class="n">${esc(i.incident_ref || (i.id || '').slice(0, 8))}</td>
                <td>${esc(i.title)}</td>
                <td>${esc(i.incident_category || i.type || '—')}</td>
                <td>${chipP(i.severity || 'P3 Normal')}</td>
                <td>${chipS(i.status || 'Open')}</td>
                <td class="n">${fmtDate(i.discovered_at || i.created_at)}</td>
                <td><button class="btn sec sm" onclick="window.__openIncident('${i.id}')">Open</button></td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

window.__openIncident = (id) => {
  const i = incidents.find(x => x.id === id)
  if (!i) return
  const notes = (incidentNotes || []).filter(n => n.incident_id === id)
  showModal('Incident — ' + esc(i.incident_ref || i.title), `
    <div class="detail-grid">
      <div class="detail-row"><div class="label">Title</div><div class="value">${esc(i.title)}</div></div>
      <div class="detail-row"><div class="label">Category / type</div><div class="value">${esc(i.incident_category || i.type || '—')}</div></div>
      <div class="detail-row"><div class="label">Severity</div><div class="value">${chipP(i.severity)}</div></div>
      <div class="detail-row"><div class="label">Status</div><div class="value">${chipS(i.status)}</div></div>
      <div class="detail-row"><div class="label">Description</div><div class="value">${esc(i.description || '—')}</div></div>
      <div class="detail-row"><div class="label">Business impact</div><div class="value">${esc(i.business_impact || '—')}</div></div>
      <div class="detail-row"><div class="label">Root cause</div><div class="value">${esc(i.root_cause || 'Not Recorded')}</div></div>
      <div class="detail-row"><div class="label">Investigation findings</div><div class="value">${esc(i.investigation_findings || '—')}</div></div>
      <div class="detail-row"><div class="label">Immediate actions</div><div class="value">${esc(i.immediate_actions || '—')}</div></div>
      <div class="detail-row"><div class="label">Escalation details</div><div class="value">${esc(i.escalation_details || '—')}</div></div>
      <div class="detail-row"><div class="label">Resolution</div><div class="value">${esc(i.resolution_details || '—')}</div></div>
      <div class="detail-row"><div class="label">Preventive recommendations</div><div class="value">${esc(i.preventive_recommendations || '—')}</div></div>
    </div>
    <h4 style="margin:16px 0 8px">Incident notes / timeline</h4>
    <div class="tw">
      <table>
        <tr><th>When</th><th>Author</th><th>Update</th><th>Action</th><th>Next</th></tr>
        ${notes.length === 0 ? '<tr><td colspan="5" class="empty">No notes yet</td></tr>' :
          notes.map(n => `
            <tr>
              <td class="n">${fmtDate(n.created_at)}</td>
              <td>${esc(n.author_email || '—')}</td>
              <td>${esc(n.investigation_update || '—')}</td>
              <td>${esc(n.action_taken || '—')}</td>
              <td>${esc(n.next_action || '—')}</td>
            </tr>
          `).join('')}
      </table>
    </div>
    ${canWrite() ? `<div style="margin-top:12px"><button class="btn sec" id="add-inc-note">+ Add note</button></div>` : ''}
  `)
  const btn = $('#add-inc-note')
  if (btn) btn.onclick = () => openIncidentNoteForm(id)
}

function openIncidentNoteForm(incidentId) {
  showModal('Add incident note', `
    <div class="form-grid">
      <div style="grid-column:1/-1"><label>Investigation update</label><textarea id="in_upd" rows="2" style="width:100%"></textarea></div>
      <div style="grid-column:1/-1"><label>Action taken</label><textarea id="in_act" rows="2" style="width:100%"></textarea></div>
      <div style="grid-column:1/-1"><label>Findings</label><textarea id="in_find" rows="2" style="width:100%"></textarea></div>
      <div style="grid-column:1/-1"><label>Pending dependency</label><input id="in_dep" style="width:100%"></div>
      <div style="grid-column:1/-1"><label>Next action</label><input id="in_next" style="width:100%"></div>
    </div>
  `, `<button class="btn" id="save-inc-note">Save note</button>`)
  $('#save-inc-note').onclick = async () => {
    const { error } = await supabase.from('incident_notes').insert({
      incident_id: incidentId,
      author_id: currentProfile?.id || null,
      author_email: currentUser?.email || null,
      investigation_update: $('#in_upd').value.trim() || null,
      action_taken: $('#in_act').value.trim() || null,
      findings: $('#in_find').value.trim() || null,
      pending_dependency: $('#in_dep').value.trim() || null,
      next_action: $('#in_next').value.trim() || null
    })
    if (error) return toast(error.message)
    toast('Note added to audit trail')
    closeModal()
    await loadAllData()
    window.__openIncident(incidentId)
  }
}

function openIncidentForm() {
  if (!canWrite()) return toast('Not allowed')
  showModal('New technical incident', `
    <div class="form-grid">
      <div style="grid-column:1/-1"><label>Title *</label><input id="inc_title" style="width:100%"></div>
      <div><label>Category</label>
        <select id="inc_type" style="width:100%">
          <option>Incident / Outage</option><option>Device / MDM</option><option>KAVRO</option>
          <option>FDX</option><option>Payment / Transaction</option><option>Application / Platform</option>
          <option>Security</option><option>Other</option>
        </select>
      </div>
      <div><label>Severity</label>
        <select id="inc_sev" style="width:100%">
          ${INCIDENT_SEVERITIES.map(p => `<option ${p==='High'?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div style="grid-column:1/-1"><label>Description</label><textarea id="inc_desc" rows="2" style="width:100%"></textarea></div>
      <div style="grid-column:1/-1"><label>Business impact</label><textarea id="inc_impact" rows="2" style="width:100%"></textarea></div>
      <div style="grid-column:1/-1"><label>Immediate actions taken</label><textarea id="inc_actions" rows="2" style="width:100%"></textarea></div>
    </div>
  `, `
    <button class="btn" id="save-inc">Create</button>
    <button class="btn sec" onclick="closeModal()">Cancel</button>
  `)
  setTimeout(() => {
    $('#save-inc').onclick = async () => {
      const title = $('#inc_title').value.trim()
      if (!title) return toast('Title required')
      const ref = 'INC-' + Date.now().toString().slice(-6)
      const { data, error } = await supabase.from('incidents').insert({
        title,
        incident_ref: ref,
        type: $('#inc_type').value,
        incident_category: $('#inc_type').value,
        severity: $('#inc_sev').value,
        description: $('#inc_desc')?.value?.trim() || null,
        business_impact: $('#inc_impact')?.value?.trim() || null,
        immediate_actions: $('#inc_actions')?.value?.trim() || null,
        reporting_officer_id: currentProfile?.id || null,
        status: 'Open',
        discovered_at: new Date().toISOString()
      }).select('id').single()
      if (error) return toast(error.message)
      await logActivity('incident.created', 'incident', data?.id, { title, ref })
      toast('Incident recorded: ' + ref)
      closeModal()
      await loadAllData()
      renderTab()
    }
  }, 0)
}

function viewDailyReport() {
  if (!(isOfficer() || isDeptHead())) return '<div class="card empty">Daily reports are for officers and department heads</div>'
  const today = new Date().toISOString().slice(0, 10)
  const mine = (dailyReports || []).filter(r =>
    (currentProfile?.id && r.officer_id === currentProfile.id) || false
  )
  const todayRow = mine.find(r => r.report_date === today)
  const myTickets = tickets.filter(isAssignedToMe)
  const handled = myTickets.filter(t => t.updated_at && t.updated_at.slice(0, 10) === today).length
  const resolved = myTickets.filter(t => (t.status === 'RESOLVED' || t.status === 'CLOSED') && t.resolved_at && t.resolved_at.slice(0, 10) === today).length
  const escalated = myTickets.filter(t => t.escalated && t.escalated_at && t.escalated_at.slice(0, 10) === today).length

  return `
    <div class="card">
      <h3>Submit daily activity report</h3>
      <p class="muted">Record what you handled today. Pre-filled from your ticket activity where possible.</p>
      <div class="form-grid" style="margin-top:12px">
        <div><label>Date</label><input id="dr_date" type="date" value="${today}" style="width:100%"></div>
        <div><label>Tickets handled</label><input id="dr_handled" type="number" value="${todayRow?.tickets_handled ?? handled}" style="width:100%"></div>
        <div><label>Tickets resolved</label><input id="dr_resolved" type="number" value="${todayRow?.tickets_resolved ?? resolved}" style="width:100%"></div>
        <div><label>Tickets escalated</label><input id="dr_esc" type="number" value="${todayRow?.tickets_escalated ?? escalated}" style="width:100%"></div>
        <div><label>Incidents logged</label><input id="dr_inc" type="number" value="${todayRow?.incidents_logged ?? 0}" style="width:100%"></div>
        <div class="full"><label>Summary of work</label><textarea id="dr_sum" rows="3" style="width:100%">${esc(todayRow?.summary || '')}</textarea></div>
        <div class="full"><label>Challenges / blockers</label><textarea id="dr_ch" rows="2" style="width:100%">${esc(todayRow?.challenges || '')}</textarea></div>
        <div class="full"><label>Next actions</label><textarea id="dr_next" rows="2" style="width:100%">${esc(todayRow?.next_actions || '')}</textarea></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn" id="save-daily">${todayRow ? 'Update report' : 'Submit report'}</button>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>My recent daily reports</h3>
      <div class="tw">
        <table>
          <tr><th>Date</th><th>Handled</th><th>Resolved</th><th>Escalated</th><th>Submitted</th></tr>
          ${mine.length === 0 ? '<tr><td colspan="5" class="empty">No reports yet</td></tr>' :
            mine.slice(0, 14).map(r => `
              <tr>
                <td class="n">${esc(r.report_date)}</td>
                <td>${r.tickets_handled ?? 0}</td>
                <td>${r.tickets_resolved ?? 0}</td>
                <td>${r.tickets_escalated ?? 0}</td>
                <td class="n">${fmtDate(r.submitted_at)}</td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

async function submitDailyReport() {
  if (!currentProfile?.id) return toast('Profile required — ensure profiles migration and your user row exist')
  const report_date = $('#dr_date').value
  const payload = {
    report_date,
    officer_id: currentProfile.id,
    tickets_handled: parseInt($('#dr_handled').value, 10) || 0,
    tickets_resolved: parseInt($('#dr_resolved').value, 10) || 0,
    tickets_escalated: parseInt($('#dr_esc').value, 10) || 0,
    incidents_logged: parseInt($('#dr_inc').value, 10) || 0,
    summary: $('#dr_sum').value.trim() || null,
    challenges: $('#dr_ch').value.trim() || null,
    next_actions: $('#dr_next').value.trim() || null,
    submitted_at: new Date().toISOString()
  }
  const { error } = await supabase.from('daily_reports').upsert(payload, { onConflict: 'report_date,officer_id' })
  if (error) return toast(error.message)
  await logActivity('daily_report.submitted', 'daily_report', null, { report_date })
  toast('Daily report saved')
  await loadAllData()
  renderTab()
}

function viewMyMetrics() {
  if (!(isOfficer() || isDeptHead())) return '<div class="card empty">Personal metrics for officers and department heads</div>'
  const mine = tickets.filter(isAssignedToMe)
  const open = mine.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status)).length
  const resolved = mine.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length
  const escalated = mine.filter(t => t.escalated).length
  const unacked = mine.filter(t => !t.acknowledged_at && !['RESOLVED', 'CLOSED'].includes(t.status)).length
  const withSla = mine.filter(t => t.sla_due_at)
  const breached = withSla.filter(t => new Date(t.sla_due_at) < new Date() && !['RESOLVED', 'CLOSED'].includes(t.status)).length
  const myReports = (dailyReports || []).filter(r => currentProfile?.id && r.officer_id === currentProfile.id)
  const reportsThisMonth = myReports.filter(r => {
    const d = r.report_date || ''
    const now = new Date()
    return d.startsWith(now.toISOString().slice(0, 7))
  }).length

  const deptTickets = isDeptHead() && myDeptId()
    ? tickets.filter(isMyDepartmentTicket)
    : []

  return `
    <div class="grid tiles" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:16px">
      <div class="card tile"><div class="v">${open}</div><div class="l">My open</div></div>
      <div class="card tile"><div class="v">${resolved}</div><div class="l">My resolved</div></div>
      <div class="card tile"><div class="v">${escalated}</div><div class="l">My escalated</div></div>
      <div class="card tile"><div class="v">${unacked}</div><div class="l">Awaiting ack</div></div>
      <div class="card tile"><div class="v">${breached}</div><div class="l">SLA breached</div></div>
      <div class="card tile"><div class="v">${reportsThisMonth}</div><div class="l">Reports this month</div></div>
    </div>
    ${isDeptHead() && myDeptId() ? `
      <div class="card" style="margin-bottom:16px">
        <h3>Department action items</h3>
        <p class="muted">${deptTickets.filter(t => !['RESOLVED','CLOSED'].includes(t.status)).length} open ticket(s) in your department · ${deptTickets.filter(t => t.escalated && !['RESOLVED','CLOSED'].includes(t.status)).length} escalated</p>
        <div class="tw">
          <table>
            <tr><th>No</th><th>Title</th><th>Status</th><th>Officer</th><th>Priority</th></tr>
            ${deptTickets.filter(t => !['RESOLVED','CLOSED'].includes(t.status)).slice(0, 15).map(t => `
              <tr>
                <td class="n">${esc(t.ticket_no)}</td>
                <td>${esc(t.title)}</td>
                <td>${esc(t.status)}</td>
                <td>${esc(t.officer || '—')}</td>
                <td>${chipP(t.priority)}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" class="empty">No open department tickets</td></tr>'}
          </table>
        </div>
      </div>
    ` : ''}
    <div class="card">
      <h3>My recent tickets</h3>
      <div class="tw">
        <table>
          <tr><th>No</th><th>Title</th><th>Status</th><th>Priority</th><th>Updated</th></tr>
          ${mine.slice(0, 12).map(t => `
            <tr>
              <td class="n">${esc(t.ticket_no)}</td>
              <td>${esc(t.title)}</td>
              <td>${esc(t.status)}</td>
              <td>${chipP(t.priority)}</td>
              <td class="n">${fmtDate(t.updated_at || t.created_at)}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" class="empty">No assigned tickets</td></tr>'}
        </table>
      </div>
    </div>
  `
}

function viewOfficers() {
  const q = ($('#off-q')?.value || '').trim().toLowerCase()
  const roleF = $('#off-role')?.value || ''
  const statusF = $('#off-status')?.value || ''
  let list = profiles.slice()
  if (q) list = list.filter(p => ((p.full_name || '') + (p.email || '') + (p.staff_id || '') + (p.designation || '')).toLowerCase().includes(q))
  if (roleF) list = list.filter(p => p.role === roleF)
  if (statusF) list = list.filter(p => (p.account_status || 'Active') === statusF)

  return `
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Technical Support Officer Management</h3>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <input id="off-q" placeholder="Search name, staff ID, email…" value="${esc(q)}" style="min-width:180px">
          <select id="off-role"><option value="">All roles</option>${ROLES.map(r => `<option value="${r}" ${roleF===r?'selected':''}>${r}</option>`).join('')}</select>
          <select id="off-status"><option value="">All statuses</option>${ACCOUNT_STATUSES.map(s => `<option value="${s}" ${statusF===s?'selected':''}>${s}</option>`).join('')}</select>
          <button class="btn sec" id="apply-off-filters">Filter</button>
          <button class="btn sec" id="export-officers">Export CSV</button>
        </div>
      </div>
      <p class="muted" style="margin:8px 0 0">Profiles, workload, assigned / resolved / pending / escalated tickets, average response time and resolution performance.</p>
    </div>
    <div class="card">
      <div class="tw">
        <table>
          <tr>
            <th>Officer</th><th>Staff ID</th><th>Email</th><th>Dept</th><th>Designation</th><th>Role</th>
            <th>Status</th><th>Assigned</th><th>Resolved</th><th>Pending</th><th>Escalated</th><th>Avg resp.</th><th>Res. rate</th>
          </tr>
          ${list.length === 0 ? '<tr><td colspan="13" class="empty">No officers found</td></tr>' :
            list.map(p => {
              const st = officerStats(p.id, p.email)
              return `
                <tr class="click" onclick="window.__viewOfficer('${esc(p.id || p.email)}')">
                  <td><strong>${esc(p.full_name)}</strong>${p.date_joined ? `<div class="muted" style="font-size:11px">Joined ${esc(fmtDay(p.date_joined))}</div>` : ''}</td>
                  <td class="n">${esc(p.staff_id || '—')}</td>
                  <td>${esc(p.official_email || p.email)}</td>
                  <td>${esc(p.departments?.name || '—')}</td>
                  <td>${esc(p.designation || '—')}</td>
                  <td><span class="chip b">${esc(p.role)}</span></td>
                  <td>${chipS(p.account_status || 'Active')}</td>
                  <td class="n">${st.assigned}</td>
                  <td class="n">${st.resolved}</td>
                  <td class="n">${st.pending}</td>
                  <td class="n">${st.escalated}</td>
                  <td class="n">${st.avgResponseMin != null ? st.avgResponseMin + 'm' : 'N/A'}</td>
                  <td class="n">${st.resolutionRate}%</td>
                </tr>`
            }).join('')}
        </table>
      </div>
    </div>
  `
}

window.__viewOfficer = (id) => {
  const p = profiles.find(x => x.id === id || x.email === id)
  if (!p) return
  const st = officerStats(p.id, p.email)
  showModal('Officer profile — ' + esc(p.full_name), `
    <div class="detail-grid">
      <div class="detail-row"><div class="label">Full name</div><div class="value">${esc(p.full_name)}</div></div>
      <div class="detail-row"><div class="label">Staff ID</div><div class="value">${esc(p.staff_id || 'Not Recorded')}</div></div>
      <div class="detail-row"><div class="label">Official email</div><div class="value">${esc(p.official_email || p.email)}</div></div>
      <div class="detail-row"><div class="label">Phone</div><div class="value">${esc(p.phone || 'Not Recorded')}</div></div>
      <div class="detail-row"><div class="label">Department</div><div class="value">${esc(p.departments?.name || '—')}</div></div>
      <div class="detail-row"><div class="label">Designation</div><div class="value">${esc(p.designation || 'Not Recorded')}</div></div>
      <div class="detail-row"><div class="label">Assigned role</div><div class="value">${esc(p.role)}</div></div>
      <div class="detail-row"><div class="label">Date joined</div><div class="value">${esc(fmtDay(p.date_joined) || 'Not Recorded')}</div></div>
      <div class="detail-row"><div class="label">Account status</div><div class="value">${chipS(p.account_status || 'Active')}</div></div>
      <div class="detail-row"><div class="label">Current workload (pending)</div><div class="value">${st.pending}</div></div>
      <div class="detail-row"><div class="label">Assigned tickets</div><div class="value">${st.assigned}</div></div>
      <div class="detail-row"><div class="label">Resolved</div><div class="value">${st.resolved}</div></div>
      <div class="detail-row"><div class="label">Pending</div><div class="value">${st.pending}</div></div>
      <div class="detail-row"><div class="label">Escalated</div><div class="value">${st.escalated}</div></div>
      <div class="detail-row"><div class="label">Avg response time</div><div class="value">${st.avgResponseMin != null ? st.avgResponseMin + ' min' : 'Not Available'}</div></div>
      <div class="detail-row"><div class="label">Resolution performance</div><div class="value">${st.resolutionRate}%</div></div>
    </div>
  `)
}

function viewDeviceOps() {
  const typeF = $('#do-type')?.value || ''
  const statusF = $('#do-status')?.value || ''
  let list = deviceOps.slice()
  if (typeF) list = list.filter(d => d.ops_type === typeF)
  if (statusF) list = list.filter(d => d.status === statusF)

  return `
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Device &amp; Technical Operations Register</h3>
        <div class="row" style="gap:8px">
          <select id="do-type"><option value="">All types</option>${DEVICE_OPS_TYPES.map(t => `<option value="${t}" ${typeF===t?'selected':''}>${t.replace('_',' / ')}</option>`).join('')}</select>
          <select id="do-status"><option value="">All statuses</option>${['Open','In Progress','Pending','Escalated','Resolved','Closed','Completed'].map(s => `<option ${statusF===s?'selected':''}>${s}</option>`).join('')}</select>
          <button class="btn sec" id="apply-do-filters">Filter</button>
          ${canWrite() ? '<button class="btn" id="add-device-ops">+ New record</button>' : ''}
        </div>
      </div>
      <p class="muted" style="margin:8px 0 0">KAVRO / MDM · FDX · BNPL device operations · Enrollment. Track enrollment, policy sync, lock/unlock, IMEI validation, swaps, unlocks and escalations.</p>
    </div>
    <div class="card">
      <div class="tw">
        <table>
          <tr><th>Ref</th><th>Type</th><th>Title</th><th>IMEI / Device</th><th>Status</th><th>Priority</th><th>Updated</th></tr>
          ${list.length === 0 ? '<tr><td colspan="7" class="empty">No device operations records. Run migration 005 and add records.</td></tr>' :
            list.map(d => `
              <tr class="click" onclick="window.__viewDeviceOps('${d.id}')">
                <td class="n">${esc(d.reference_no || d.id.slice(0, 8))}</td>
                <td>${esc((d.ops_type || '').replace('_', ' / '))}</td>
                <td>${esc(d.title || '—')}</td>
                <td class="n">${esc(d.device_imei || d.original_imei || d.replacement_imei || '—')}</td>
                <td>${chipS(d.status)}</td>
                <td>${chipP(d.priority)}</td>
                <td class="n">${fmtDate(d.updated_at || d.created_at)}</td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

window.__viewDeviceOps = (id) => {
  const d = deviceOps.find(x => x.id === id)
  if (!d) return
  showModal('Device ops — ' + esc(d.reference_no || id.slice(0, 8)), `
    <div class="detail-grid">
      <div class="detail-row"><div class="label">Type</div><div class="value">${esc(d.ops_type)}</div></div>
      <div class="detail-row"><div class="label">Title</div><div class="value">${esc(d.title)}</div></div>
      <div class="detail-row"><div class="label">Status</div><div class="value">${chipS(d.status)}</div></div>
      <div class="detail-row"><div class="label">IMEI</div><div class="value">${esc(d.device_imei || '—')}</div></div>
      <div class="detail-row"><div class="label">Original / Replacement IMEI</div><div class="value">${esc(d.original_imei || '—')} / ${esc(d.replacement_imei || '—')}</div></div>
      <div class="detail-row"><div class="label">Merchant / Customer ref</div><div class="value">${esc(d.merchant_info || '—')} · ${esc(d.customer_reference || '—')}</div></div>
      <div class="detail-row"><div class="label">Notes</div><div class="value">${esc(d.notes || '—')}</div></div>
    </div>
  `)
}

function viewDocuments() {
  const q = ($('#doc-q')?.value || '').trim().toLowerCase()
  let list = documents.slice()
  if (q) list = list.filter(d => ((d.title || '') + (d.filename || '') + (d.category || '') + (d.description || '')).toLowerCase().includes(q))

  return `
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Document &amp; Report Upload Center</h3>
        <div class="row" style="gap:8px">
          <input id="doc-q" placeholder="Search documents…" value="${esc(q)}" style="min-width:160px">
          <button class="btn sec" id="apply-doc-filters">Search</button>
        </div>
      </div>
      <p class="muted" style="margin:8px 0 0">PDF, DOCX, PPT/PPTX, JPG, PNG. Title, category, reporting period, department, related ticket/incident, version history and audit trail.</p>
      ${canWrite() ? `
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:end">
          <div><label>Title</label><input id="doc-title" placeholder="Document title" style="width:180px"></div>
          <div><label>Category</label><input id="doc-cat" placeholder="e.g. Monthly report" style="width:140px"></div>
          <div><label>File</label><input type="file" id="doc-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"></div>
          <button class="btn" id="upload-doc">Upload</button>
        </div>
      ` : ''}
    </div>
    <div class="card">
      <div class="tw">
        <table>
          <tr><th>Title</th><th>Category</th><th>Period</th><th>Type</th><th>Size</th><th>Uploaded</th><th>By</th></tr>
          ${list.length === 0 ? '<tr><td colspan="7" class="empty">No documents recorded. Configure Storage and upload evidence or reports.</td></tr>' :
            list.map(d => `
              <tr>
                <td>${esc(d.title || d.filename)}</td>
                <td>${esc(d.category || '—')}</td>
                <td>${esc(d.reporting_period || '—')}</td>
                <td class="n">${esc((d.mime_type || d.filename || '').split('/').pop() || d.filename)}</td>
                <td class="n">${d.size_bytes != null ? (Math.round(d.size_bytes / 1024) + ' KB') : '—'}</td>
                <td class="n">${fmtDate(d.created_at)}</td>
                <td>${esc(d.uploaded_by || '—')}</td>
              </tr>
            `).join('')}
        </table>
      </div>
    </div>
  `
}

function viewReports() {
  const total = tickets.length
  const resolved = tickets.filter(t => ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(normalizeStatus(t.status))).length
  const breached = tickets.filter(isSlaBreached).length
  const openInc = incidents.filter(i => !['Resolved', 'Closed'].includes(i.status)).length

  return `
    <div class="card brand-header" style="margin-bottom:16px">
      <h3 style="margin:0">Monthly Management Report Generator</h3>
      <p class="muted" style="margin:6px 0 0">
        Structure aligned with CredLock Technical Support Management Report. Figures are calculated from system records only.
        Where data is unavailable: <strong>Not Available</strong> or <strong>Not Recorded</strong>.
      </p>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Generate report</h3>
      <div class="row" style="flex-wrap:wrap;gap:12px;align-items:end">
        <div><label>Report type</label>
          <select id="rpt-type">
            <option value="monthly">Monthly report</option>
            <option value="weekly">Weekly report</option>
            <option value="daily">Daily report</option>
            <option value="quarterly">Quarterly report</option>
            <option value="custom">Custom date range</option>
            <option value="department">Department-specific</option>
            <option value="officer">Officer-specific</option>
            <option value="incident">Incident report</option>
            <option value="executive">Executive management report</option>
          </select>
        </div>
        <div><label>Period start</label><input type="date" id="rpt-start"></div>
        <div><label>Period end</label><input type="date" id="rpt-end"></div>
        <button class="btn" id="gen-report">Generate structured report</button>
      </div>
      <p class="muted" style="margin-top:10px">Export targets: PDF (print-ready), DOCX (editable), PPTX (executive slides) with navy / teal CredLock branding. Client-side export libraries can be wired to the payload below.</p>
    </div>

    <div class="card" id="report-preview">
      <h3>Report structure (live snapshot)</h3>
      <ol class="report-structure">
        <li><strong>Cover / header</strong> — CredLock Africa Technical Support Management Report</li>
        <li><strong>Reporting period</strong> — Select dates above · Department: Technical Support</li>
        <li><strong>Executive summary</strong> — ${total} tickets in system · ${resolved} resolved · ${breached} SLA breaches · ${openInc} open incidents</li>
        <li><strong>Previous month performance</strong> — Not Available (requires period filter on historical data)</li>
        <li><strong>Previous month key achievements</strong> — Not Recorded</li>
        <li><strong>Previous month challenges</strong> — Not Recorded</li>
        <li><strong>Current period key achievements</strong> — Derived from resolved tickets and closed incidents when period selected</li>
        <li><strong>Current period challenges</strong> — Escalations: ${tickets.filter(t => t.escalated).length} · Open critical: ${tickets.filter(t => String(t.priority||'').includes('P1') || t.priority==='Critical').filter(t => !['Resolved','Closed'].includes(normalizeStatus(t.status))).length}</li>
        <li><strong>Ticket volume &amp; category breakdown</strong> — See KPI dashboard and Tickets module</li>
        <li><strong>Weekly trends</strong> — Not Available without date-bucketed aggregates</li>
        <li><strong>Operational performance highlights</strong> — Resolution rate ${total ? Math.round(resolved/total*100) : 0}%</li>
        <li><strong>KAVRO / FDX / device ops</strong> — KAVRO: ${kavro.length} · Device ops: ${deviceOps.length}</li>
        <li><strong>Incident &amp; escalation summary</strong> — Incidents: ${incidents.length} · Escalated tickets: ${tickets.filter(t => t.escalated).length}</li>
        <li><strong>KPI scorecard</strong> — See Dashboard / KPI tab</li>
        <li><strong>SLA performance</strong> — Breaches: ${breached} · Targets: P1 5m · P2 10m · P3 30m · P4 2h</li>
        <li><strong>Officer workload &amp; performance</strong> — See Officers module</li>
        <li><strong>Outstanding issues &amp; corrective actions</strong> — From Recommendations module</li>
        <li><strong>Recommendations for management</strong> — ${recommendations.filter(r => r.status === 'Open' || r.status === 'In Progress').length} open</li>
        <li><strong>Next month action plan</strong> — Not Recorded</li>
        <li><strong>Responsible departments &amp; action owners</strong> — Departments module</li>
        <li><strong>Management support / decisions required</strong> — Not Recorded</li>
        <li><strong>Conclusion</strong> — Auto-generated from metrics above when exported</li>
      </ol>
      <p class="muted">Generated reports are stored in <code>management_reports</code> when the generate action is used with Supabase connected.</p>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Upload supporting report file</h3>
      <input type="file" id="report-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg">
      <button class="btn" style="margin-left:8px" id="upload-report">Upload</button>
      <div class="muted" style="margin-top:8px">Configure Storage bucket "reports" in Supabase Dashboard.</div>
    </div>
  `
}

function viewTeam() {
  return `
    <div class="card">
      <h3>Team directory</h3>
      <p class="muted">For full officer metrics, workload and export use the <strong>Officers</strong> module.</p>
      <div class="tw">
        <table>
          <tr><th>Name</th><th>Staff ID</th><th>Email</th><th>Role</th><th>Status</th><th>Department</th><th>Pending workload</th></tr>
          ${profiles.length === 0 ? '<tr><td colspan="7" class="empty">No team members loaded</td></tr>' :
            profiles.map(m => {
              const st = officerStats(m.id, m.email)
              return `
              <tr>
                <td>${esc(m.full_name)}</td>
                <td class="n">${esc(m.staff_id || '—')}</td>
                <td>${esc(m.email)}</td>
                <td><span class="chip b">${esc(m.role)}</span></td>
                <td>${chipS(m.account_status || 'Active')}</td>
                <td>${esc(m.departments?.name || '—')}</td>
                <td class="n">${st.pending}</td>
              </tr>`
            }).join('')}
        </table>
      </div>
    </div>
  `
}

// ─── Modal ───────────────────────────────────────────────────
function showModal(title, bodyHtml, footerHtml) {
  closeModal()
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `
    <div class="modal">
      <header>
        <h2>${title}</h2>
        <div class="sp"></div>
        <button class="btn sec sm" onclick="closeModal()">✕</button>
      </header>
      <div class="body">${bodyHtml}</div>
      <div class="footer">${footerHtml || ''}</div>
    </div>
  `
  backdrop.onclick = (e) => { if (e.target === backdrop) closeModal() }
  document.body.appendChild(backdrop)
}

window.closeModal = closeModal
