import { supabase } from './supabase.js'
import { renderApp, renderLogin } from './app.js'

async function boot() {
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    await renderApp(session.user)
  } else {
    renderLogin()
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      renderApp(session.user)
    } else {
      renderLogin()
    }
  })
}

boot()
