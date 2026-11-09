# CredLock Technical Support Desk

Operations portal for tickets, SLA, incidents, device ops / KAVRO, officers, documents, and management reports.

**Stack:** Vite · React 18 · TypeScript · Supabase · Chart.js · jsPDF / docx / pptxgenjs

## Quick start (Windows PowerShell)

```powershell
cd C:\Users\April\Desktop\credlock-desk-from-github
git pull origin main
Copy-Item .env.example .env
# Edit .env — VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (no quotes)
npm install
npm run dev
```

Open http://localhost:5173/

> In PowerShell use `#` for comments, not `REM`.

## Supabase setup (required for create / edit / upload)

1. **SQL Editor** — run migrations in order:
   - `001` … `005`
   - `006_storage_attachments.sql`
   - **`007_full_crud_rls.sql`** ← enables create/update/delete + Storage

2. **Storage** — confirm bucket `attachments` exists.

3. **Auth** — create users; set role in `profiles` or `team`.

4. **API keys** — put URL + anon key in `.env`.

## Modules

Dashboard · Tickets (SLA, assign, history, attachments, CSV) · Officers · Incidents · Device Ops / KAVRO · Documents · Reports (PDF/DOCX/PPTX) · Playbooks · Recommendations · Departments · Daily report · Activity · My Metrics

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Failed to fetch | `.env` + restart dev server |
| Cannot create/edit | Run **007_full_crud_rls.sql** |
| Upload error | Bucket `attachments` + 006/007 |
| REM not recognized | Use PowerShell `#` comments |
