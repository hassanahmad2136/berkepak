# BerkePak Local Development Guide

## Stack
- **Frontend:** Next.js (`web/`)
- **Backend:** Supabase (local Docker container via Supabase CLI)
- **Saleor/Django backend is deprecated and no longer used.**

---

## Quick Start

### 1. Start Local Supabase
```bash
cd web
npx supabase start
```
First run pulls Docker images — takes 5–10 minutes. Subsequent runs are fast.

### 2. Start the Frontend
```bash
cd web
npm install   # first time only
npm run dev
```

---

## Local Access Links

| Service | URL |
|---------|-----|
| Storefront | http://localhost:3000 |
| Supabase Studio (DB UI) | http://localhost:54323 |
| Supabase API | http://localhost:54321 |
| Supabase Auth | http://localhost:54321/auth/v1 |
| Inbucket (local email) | http://localhost:54324 |

> Run `npx supabase status` inside `web/` to confirm ports and see local anon/service keys.

---

## Stopping

```bash
# Stop Next.js: Ctrl+C in its terminal

# Stop Supabase
cd web
npx supabase stop
```

---

## Troubleshooting

- **Supabase not starting:** Make sure Docker Desktop is running first.
- **Schema out of date:** Run `npx supabase db reset` inside `web/` to replay all migrations from scratch (wipes local data).
- **Env vars missing:** Copy `web/.env.local.example` to `web/.env.local` and fill in the local Supabase URL/keys from `npx supabase status`.
