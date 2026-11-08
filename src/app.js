/**
 * PLACEHOLDER — full application is in credlock-desk-complete.zip
 * After extracting the zip over this repo, run:
 *   git add src/app.js && git commit -m "Add full app.js" && git push
 */
export function renderLogin() {
  const el = document.getElementById('app')
  if (!el) return
  el.innerHTML = `
    <div class="login-screen">
      <div class="login-panel card">
        <h2>CredLock — almost ready</h2>
        <p>Full <code>src/app.js</code> is not on this branch yet (file size limit from cloud push).</p>
        <p>1. Download <strong>credlock-desk-complete.zip</strong><br>
           2. Extract over this folder<br>
           3. <code>git add -A && git commit -m "Add full app.js" && git push</code></p>
        <p class="muted">See SYNC.md for details.</p>
      </div>
    </div>`
}

export async function renderApp() {
  renderLogin()
}
