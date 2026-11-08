export type Role = 'Super Admin' | 'Team Lead' | 'Officer' | 'Viewer' | string

export type TabId =
  | 'dashboard'
  | 'tickets'
  | 'officers'
  | 'incidents'
  | 'deviceops'
  | 'kavro'
  | 'documents'
  | 'reports'
  | 'team'

export interface Profile {
  id: string
  email: string
  full_name?: string | null
  role?: Role | null
  department_id?: string | null
  account_status?: string | null
}

export interface Ticket {
  id: string
  ticket_no?: string
  title?: string
  status?: string
  priority?: string
  category?: string
  issue_type?: string
  officer?: string
  assigned_to?: string
  created_at?: string
  escalated?: boolean
}

export interface Incident {
  id: string
  title?: string
  status?: string
  severity?: string
  created_at?: string
}

export interface DeviceOp {
  id: string
  status?: string
  title?: string
  created_at?: string
}
