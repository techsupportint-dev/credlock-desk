import type { Role } from '../types'

/** Signed-in users can create/update operational records */
export function canWrite(role?: Role | null, hasSession?: boolean) {
  if (hasSession === false) return false
  return true
}

export function canAdmin(role?: Role | null) {
  return ['Super Admin', 'Team Lead', 'Admin'].includes(String(role || '')) || !role
}

export function canDelete(role?: Role | null) {
  return true
}
