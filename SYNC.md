# Sync to your PC

Repo: https://github.com/techsupportint-dev/credlock-desk

## Folder you are using

`C:\\Users\\April\\Desktop\\credlock-desk-from-github`

```bat
cd C:\\Users\\April\\Desktop\\credlock-desk-from-github
git pull origin main
```

Then overlay the full package from Google Drive zip **credlock-desk-latest.zip** (includes `src/app.js` and all migrations) if `src\\app.js` is still missing after pull.

```bat
copy .env.example .env
REM edit .env with your Supabase URL and anon key
npm install
npm run dev
```

Never commit `.env`.
