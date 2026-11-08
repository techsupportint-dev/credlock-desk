import { PRIORITY_META } from './constants'
import type { Ticket } from '../types'

export function normalizeStatus(s?: string | null) {
  if (!s) return 'New'
  const map: Record<string, string> = {
    OPEN: 'New',
    IN_PROGRESS: 'In Progress',
    WAITING: 'Pending',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  }
  return map[s] || s
}

export function priorityMeta(p?: string | null) {
  if (!p) return PRIORITY_META['P3 Normal']
  return PRIORITY_META[p] || PRIORITY_META['P3 Normal']
}

export function ageMinutes(t: Ticket): number | null {
  if (!t.created_at) return null
  return Math.max(0, Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000))
}

export function firstResponseMinutes(t: Ticket): number | null {
  if (!t.created_at || !t.first_response_at) return null
  return Math.max(
    0,
    Math.round((new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / 60000)
  )
}

export function isSlaBreached(t: Ticket): boolean {
  const status = normalizeStatus(t.status)
  if (['Resolved', 'Closed'].includes(status)) return false
  if (t.first_response_at) return false
  const age = ageMinutes(t)
  if (age == null) return false
  return age > priorityMeta(t.priority).minutes
}

export function isSlaApproaching(t: Ticket): boolean {
  if (isSlaBreached(t)) return false
  if (t.first_response_at) return false
  const status = normalizeStatus(t.status)
  if (['Resolved', 'Closed'].includes(status)) return false
  const age = ageMinutes(t)
  if (age == null) return false
  const target = priorityMeta(t.priority).minutes
  return age >= target * 0.7
}

export function fmtDate(d?: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(d).slice(0, 16)
  }
}
