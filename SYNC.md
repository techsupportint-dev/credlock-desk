# CredLock Desk — React + TypeScript

**Repo:** https://github.com/techsupportint-dev/credlock-desk  
**Your folder:** `C:\\Users\\April\\Desktop\\credlock-desk-from-github`

## PowerShell (not CMD)

```powershell
cd C:\\Users\\April\\Desktop\\credlock-desk-from-github
git pull origin main
Copy-Item .env.example .env
# Edit .env with Supabase URL + anon key
npm install
npm run dev
```

Do **not** use `REM` in PowerShell — use `#` for comments, or skip comments.

## Stack

Vite · React 18 · TypeScript · Supabase · Chart.js · responsive sidebar shell

## Migrations

Run `supabase/migrations/001` → `005` in the Supabase SQL Editor.

Ignore leftover vanilla files (`src/app.js`, `src/main.js`, `src/style.css`) if still present — the app entry is `src/main.tsx`.
