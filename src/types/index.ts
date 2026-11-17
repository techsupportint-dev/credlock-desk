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
  | 'daily'
  | 'metrics'
  | 'activity'
  | 'departments'
  | 'playbooks'
  | 'recommendations'
  | 'sheets'
  | 'call_logs'
  | 'officer_reports'
  | 'devices'

export interface Profile {
  id: string
  email: string
  full_name?: string | null
  role?: Role | null
  department_id?: string | null
  account_status?: string | null
  staff_id?: string | null
  phone?: string | null
  designation?: string | null
  date_joined?: string | null
}

export interface Ticket {
  id: string
  ticket_no?: string
  title?: string
  status?: string
  priority?: string
  category?: string
  issue_type?: string
  officer?: string | null
  assigned_to?: string | null
  created_at?: string
  escalated?: boolean
  escalated_at?: string | null
  acknowledged_at?: string | null
  first_response_at?: string | null
  resolved_at?: string | null
  description?: string | null
  resolution_notes?: string | null
  investigation_summary?: string | null
  troubleshooting_steps?: string | null
  customer?: string | null
  merchant_name?: string | null
  requester_name?: string | null
  requester_contact?: string | null
  requester_type?: string | null
  source_channel?: string | null
  device_imei?: string | null
  affected_service?: string | null
  business_impact?: string | null
  department_id?: string | null
  next_action?: string | null
  followup_deadline?: string | null
  customer_followup?: string | null
  merchant_followup?: string | null
}

export interface Incident {
  id: string
  title?: string
  status?: string
  severity?: string
  created_at?: string
  description?: string | null
  affected_service?: string | null
  root_cause?: string | null
  resolution_notes?: string | null
  reported_by?: string | null
}

export interface DeviceOp {
  id: string
  status?: string
  title?: string
  created_at?: string
  op_type?: string
  device_imei?: string
  notes?: string
  officer?: string
}

export interface DocumentRow {
  id: string
  title?: string
  filename?: string
  doc_type?: string
  created_at?: string
  uploaded_by?: string
  notes?: string
  storage_path?: string
}

export interface CallLog {
  id: string
  call_id: string
  interaction_id?: string
  officer_id?: string
  officer_name?: string
  direction: 'Incoming' | 'Outgoing' | string
  caller_number?: string
  start_time?: string
  duration_sec?: number | string
  answer_status?: string
}

export interface ActivityLog {
  id: string
  activity_id: string
  interaction_id?: string
  officer_id?: string
  officer_name?: string
  channel?: string
  source?: string
  customer?: string
  customer_number?: string
  activity_type?: string
  created_at?: string
  notes?: string
}

export interface OfficerReport {
  id: string
  report_id: string
  date?: string
  officer?: string
  period?: string
  whatsapp_report?: string
  lobi_ai_report?: string
  challenges?: string
  issues?: string
  notes?: string
}

export interface DepartmentItem {
  id: string
  dept_id?: string
  name: string
  lead?: string
  email?: string
  status?: string
  notes?: string
}

export interface DeviceRecord {
  id: string
  device_id: string
  officer_id?: string
  officer_name?: string
  phone_number?: string
  manufacturer?: string
  model?: string
  imei?: string
  android_id?: string
  status?: string
}

export interface EnrollmentRecord {
  id: string
  entry_id: string
  date?: string
  device_manufacturer?: string
  device_model?: string
  enrollment_method?: string
  enrollment_result?: string
  identified_on_kavro?: string
  merchant_ref?: string
}
