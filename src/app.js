import { supabase } from './supabase.js'

/**
 * CredLock app assembled from src/chunks (GitHub size-friendly push).
 * Chunks are concatenated and executed in one shared scope with supabase injected.
 */
import c0 from './chunks/0.js?raw'
import c1 from './chunks/1.js?raw'
import c2 from './chunks/2.js?raw'

function assemble() {
  let body = String(c0) + String(c1) + String(c2)
  body = body
    .replace(/export\s+async\s+function\s+renderApp/g, 'async function renderApp')
    .replace(/export\s+function\s+renderLogin/g, 'function renderLogin')
    .replace(/export\s+async\s+function\s+renderLogin/g, 'async function renderLogin')
    .replace(/export\s+function\s+renderApp/g, 'function renderApp')
  // Strip any residual import lines
  body = body.replace(/^import\s+.+;?\s*$/gm, '')
  const factory = new Function(
    'supabase',
    body + '\n; return { renderApp: typeof renderApp !== "undefined" ? renderApp : null, renderLogin: typeof renderLogin !== "undefined" ? renderLogin : null };'
  )
  const mod = factory(supabase)
  if (!mod.renderApp || !mod.renderLogin) {
    throw new Error('CredLock app failed to assemble (missing exports)')
  }
  return mod
}

let _mod = null
function getMod() {
  if (!_mod) _mod = assemble()
  return _mod
}

export function renderLogin() {
  return getMod().renderLogin()
}

export async function renderApp(user) {
  return getMod().renderApp(user)
}
