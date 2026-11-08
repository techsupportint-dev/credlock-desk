import { supabase } from './supabase'

/** Bucket name — create in Supabase Storage as public or private "attachments" */
export const ATTACHMENTS_BUCKET = 'attachments'

export async function uploadAttachment(file: File, folder = 'general') {
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${folder}/${Date.now()}-${safe}`
  const { error: upErr } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) return { error: upErr.message, path: null as string | null }

  const { data: pub } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path)
  return { error: null as string | null, path, publicUrl: pub?.publicUrl || null }
}

export async function registerDocument(meta: {
  filename: string
  storage_path: string
  mime_type?: string
  size_bytes?: number
  entity_type?: string
  entity_id?: string | null
  uploaded_by?: string | null
  description?: string
}) {
  const payload: Record<string, unknown> = {
    filename: meta.filename,
    storage_path: meta.storage_path,
    mime_type: meta.mime_type || null,
    size_bytes: meta.size_bytes ?? null,
    entity_type: meta.entity_type || 'general',
    entity_id: meta.entity_id || null,
    uploaded_by: meta.uploaded_by || null,
    description: meta.description || null,
    title: meta.filename,
    notes: meta.description || null,
    doc_type: meta.entity_type || 'General',
  }
  const { data, error } = await supabase.from('documents').insert(payload).select('id').maybeSingle()
  return { data, error }
}
