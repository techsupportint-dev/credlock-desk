# Complete project sync

**Repo:** https://github.com/techsupportint-dev/credlock-desk  
**Your folder:** `C:\\Users\\April\\Desktop\\credlock-desk-from-github`

## Why one Desktop push is needed

`src/app.js` is large (~140 KB). The GitHub API path used from the cloud workspace cannot upload that single file in one call. Everything else is already on `main`.

## One-time finish (on your PC)

1. Download **credlock-desk-complete.zip** from the project chat / Google Drive.
2. Extract **over** your folder (replace files).
3. Then:

```bat
cd C:\\Users\\April\\Desktop\\credlock-desk-from-github
git add -A
git status
git commit -m "Add full src/app.js and remaining project files"
git push origin main
```

After that, the whole project lives on GitHub and future updates can use `git pull` / cloud push for smaller files.

## Run the app

```bat
copy .env.example .env
REM set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Never commit `.env`.
