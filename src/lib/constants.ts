export const STATUSES = [
  'New',
  'Assigned',
  'In Progress',
  'Pending',
  'Escalated',
  'Resolved',
  'Closed',
  'Reopened',
] as const

export const PRIOS = ['P1 Critical', 'P2 High', 'P3 Normal', 'P4 Low'] as const

export const PRIORITY_META: Record<string, { code: string; minutes: number; label: string }> = {
  'P1 Critical': { code: 'P1', minutes: 5, label: 'Critical' },
  'P2 High': { code: 'P2', minutes: 10, label: 'High' },
  'P3 Normal': { code: 'P3', minutes: 30, label: 'Normal' },
  'P4 Low': { code: 'P4', minutes: 120, label: 'Low' },
  Critical: { code: 'P1', minutes: 5, label: 'Critical' },
  High: { code: 'P2', minutes: 10, label: 'High' },
  Medium: { code: 'P3', minutes: 30, label: 'Normal' },
  Low: { code: 'P4', minutes: 120, label: 'Low' },
}

export const ISSUE_TYPES = [
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
  'Other',
] as const

export const REQUESTER_TYPES = ['Customer', 'Merchant', 'Internal', 'Partner'] as const
export const SOURCE_CHANNELS = ['Email', 'Phone', 'WhatsApp', 'Portal', 'Walk-in', 'Internal', 'Other'] as const

export const KAV_CATS = [
  'QR Code Error',
  'APK Install Error',
  'Config Error',
  'Policy Sync',
  'Lock/Unlock',
  'IMEI Validation',
  'Device Removal',
  'Other',
] as const

export const DEVICE_OP_TYPES = [
  'Manual device removal',
  'Manual unlock',
  'Removal + unlock',
  'Reboot',
  'IMEI swap',
  'Enrollment',
  'Device replacement',
  'Other',
] as const

export const OPEN_STATUSES = new Set([
  'New',
  'Assigned',
  'In Progress',
  'Pending',
  'Escalated',
  'Reopened',
  'OPEN',
  'IN_PROGRESS',
  'WAITING',
])

export const CLOSED_STATUSES = new Set(['Resolved', 'Closed', 'RESOLVED', 'CLOSED'])
