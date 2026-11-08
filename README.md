# CredLock Technical Support Desk (React + TypeScript)

Responsive support operations portal: **Vite · React 18 · TypeScript · Supabase · Chart.js**.

## PowerShell (Windows)

```powershell
cd C:\Users\April\Desktop\credlock-desk-from-github
Copy-Item .env.example .env
# Edit .env — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

> `REM` is for **cmd.exe**. In **PowerShell** use `#` for comments, or omit the comment line.

## Migrations

Run `supabase/migrations/` **001 → 005** in the Supabase SQL Editor.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run preview` — preview build
