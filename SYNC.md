# Sync remaining files from workspace

Most of the project is on GitHub. The full `src/app.js` (~132 KB) and migrations `003` / `005` should be taken from the project zip or workspace if missing after clone.

## On your PC (recommended)

```bat
cd C:\Users\April\Desktop
git clone https://github.com/techsupportint-dev/credlock-desk.git
cd credlock-desk
```

Download `credlock-desk-update.zip` from the project chat, extract, then copy over:

- `src\app.js`
- `supabase\migrations\003_enterprise_support.sql`
- `supabase\migrations\005_full_support_modules.sql`
- `package-lock.json` (optional; `npm install` regenerates it)

Then:

```bat
git add -A
git commit -m "Add full app.js and remaining migrations"
git push origin main
```

After that, future updates can be `git pull` only.

## Setup

```bat
copy .env.example .env
REM edit .env with Supabase URL and anon key
npm install
npm run dev
```

Run SQL migrations 001–005 in order in the Supabase SQL Editor.
