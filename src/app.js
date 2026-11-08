import { supabase } from './supabase.js'

/**
 * CredLock app assembled from gzip+base64 chunks (GitHub-friendly).
 * Runtime: decode → inflate → execute in one shared scope with supabase.
 */
import b0 from './chunks/0.js.b64?raw'
import b1 from './chunks/1.js.b64?raw'
import b2 from './chunks/2.js.b64?raw'

function b64ToUint8(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function gunzipToText(bytes) {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip')
    const stream = new Blob([bytes]).stream().pipeThrough(ds)
    return await new Response(stream).text()
  }
  throw new Error('Gzip DecompressionStream is required (use a current Chrome/Edge/Firefox)')
}

async function assemble() {
  const parts = await Promise.all([
    gunzipToText(b64ToUint8(b0)),
    gunzipToText(b64ToUint8(b1)),
    gunzipToText(b64ToUint8(b2))
  ])
  let body = parts.join('')
  body = body
    .replace(/export\s+async\s+function\s+renderApp/g, 'async function renderApp')
    .replace(/export\s+function\s+renderLogin/g, 'function renderLogin')
    .replace(/export\s+async\s+function\s+renderLogin/g, 'async function renderLogin')
    .replace(/export\s+function\s+renderApp/g, 'function renderApp')
  body = body.replace(/^import\s+.+;?\s*$/gm, '')
  const factory = new Function(
    'supabase',
    body +
      '\n; return { renderApp: typeof renderApp !== "undefined" ? renderApp : null, renderLogin: typeof renderLogin !== "undefined" ? renderLogin : null };'
  )
  const mod = factory(supabase)
  if (!mod.renderApp || !mod.renderLogin) {
    throw new Error('CredLock app failed to assemble (missing exports)')
  }
  return mod
}

let _modPromise = null
function getMod() {
  if (!_modPromise) _modPromise = assemble()
  return _modPromise
}

export function renderLogin() {
  return getMod().then((m) => m.renderLogin())
}

export async function renderApp(user) {
  const m = await getMod()
  return m.renderApp(user)
}
