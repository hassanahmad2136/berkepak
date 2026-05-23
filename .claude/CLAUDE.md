# Berke Pak - Project Context & Guidelines

## Overview
Berke Pak is an e-commerce platform tailored for fabrics and bespoke suits. 
The project has a separated architecture consisting of a **Next.js Storefront** and a **Saleor (Django/GraphQL) Backend**.

### 1. Storefront (`web/`)
- **Framework:** Next.js (React)
- **Features:** Storefront catalog, authentication, checkout (Cash on Delivery & Bank Transfer), and an admin portal for receipt approvals.
- **Backend-as-a-Service:** Uses **Supabase** for user authentication (Email, Google, Apple), orders, and receipt image storage. 
- **Current State:** The catalog currently runs on a static stub (`web/src/lib/products.ts`). OTP for Cash on Delivery is currently mocked and printed in the dev terminal.
- **Commands:** 
  - Install: `npm install`
  - Dev: `npm run dev` (Runs on `http://localhost:3000`)
  - Supabase Local: `npx supabase start`

### 2. Backend Engine (`backend/`)
- **Framework:** Saleor (Headless e-commerce built on Django & Python)
- **Features:** Core product catalog, inventory, and headless API.
- **Infrastructure:** Runs via Docker Compose (PostgreSQL, Redis, Celery workers, and Mailpit for catching local emails).
- **Current State:** Working independently via Docker. Connecting the Next.js storefront to this Saleor GraphQL API for live catalog and inventory is the primary upcoming milestone.
- **Commands:** 
  - Start: `make up` or `docker compose up -d`
  - Seed/Init: `make init` (runs migrations and creates superuser)
  - GraphQL API: `http://localhost:8000/graphql/`
  - Saleor Dashboard: `http://localhost:9000/`

## Local Development Flow
To run the full stack locally:
1. **Backend:** Navigate to `backend/` and run `docker compose up -d` (or `make init` for the first time).
2. **Web:** Navigate to `web/`, ensure Supabase is running (`npx supabase start`), and run `npm run dev`.
3. Access the web app at `http://localhost:3000`, the API at `8000`, the dashboard at `9000`, and caught emails (Mailpit) at `8025`.

## Future Milestones & Work
- **Saleor Integration:** Swap out the static catalog in the storefront with live data queries from the Saleor GraphQL backend.
- **SMS Integration:** Drop in a real SMS provider for OTP functionality (currently stubbed in `src/lib/actions/otp.ts`).
- **Abandoned Cart:** Implement cron jobs and email providers to remind users about abandoned carts.

## General Guidelines
- Do not assume the storefront uses Saleor for auth or orders; those are currently handled by Supabase. Saleor is dedicated to the product catalog and inventory.
- Ensure new storefront UI components follow the existing design system and correctly implement responsive mobile and desktop variants.
- Be aware that emails (during local dev) are caught by Mailpit (Backend) or Supabase Inbucket (Storefront).
