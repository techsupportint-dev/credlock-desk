import { supabase } from './supabase'

export async function logTicketHistory(opts: {
  ticketId: string
  changeType: string
  oldValue?: string | null
  newValue?: string | null
  actorEmail?: string | null
  actorId?: string | null
  details?: Record<string, unknown>
}) {
  const { error } = await supabase.from('ticket_history').insert({
    ticket_id: opts.ticketId,
    change_type: opts.changeType,
    old_value: opts.oldValue ?? null,
    new_value: opts.newValue ?? null,
    actor_email: opts.actorEmail ?? null,
    actor_id: opts.actorId ?? null,
    details: opts.details ?? null,
  })
  return error
}

export interface HistoryRow {
  id: string
  ticket_id: string
  change_type?: string
  old_value?: string | null
  new_value?: string | null
  actor_email?: string | null
  created_at?: string
  details?: Record<string, unknown> | null
}
