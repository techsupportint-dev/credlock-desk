import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const supabaseConfigured = Boolean(
  url &&
    key &&
    url.startsWith('https://') &&
    !url.includes('placeholder') &&
    !url.includes('your-project')
)

if (!supabaseConfigured) {
  console.error(
    '[CredLock] Missing or invalid Supabase config.\n' +
      'Create a .env file in the project root with:\n' +
      '  VITE_SUPABASE_URL=https://xxxx.supabase.co\n' +
      '  VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key\n' +
      'Then stop the server (Ctrl+C) and run: npm run dev'
  )
}

export const supabase: SupabaseClient = createClient(
  supabaseConfigured ? url : 'https://placeholder.supabase.co',
  supabaseConfigured ? key : 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

export function getSupabaseConfigHint(): string {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    return 'VITE_SUPABASE_URL is missing. Add it to .env and restart npm run dev.'
  }
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return 'VITE_SUPABASE_ANON_KEY is missing. Add it to .env and restart npm run dev.'
  }
  if (!supabaseConfigured) {
    return 'Supabase URL/key look invalid. Check .env (no quotes, no trailing spaces) and restart the dev server.'
  }
  return ''
}
