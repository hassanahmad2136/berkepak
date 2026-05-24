# Berke Pak - Project Context & Guidelines

## Overview
Berke Pak is an e-commerce platform tailored for fabrics and bespoke suits. 
The project has evolved into a monolithic frontend architecture backed purely by Supabase, deprecating its original headless Saleor backend.

### 1. Storefront (`web/`)
- **Framework:** Next.js (React)
- **Features:** Storefront catalog, authentication, checkout (Cash on Delivery & Bank Transfer), and an admin portal for receipt approvals.
- **Backend-as-a-Service:** Uses **Supabase** exclusively for user authentication (Email, Google, Apple), orders, receipt image storage, and now the **product catalog** (`product_catalog` table).
- **Current State:** Saleor has been completely removed from the data flow. The entire application relies on Supabase. OTP for Cash on Delivery is currently mocked and printed in the dev terminal.
- **Commands:** 
  - Install: `npm install`
  - Dev: `npm run dev` (Runs on `http://localhost:3000`)
  - Supabase Local: `npx supabase start`

### 2. Backend Engine (`backend/` - Deprecated)
- **Framework:** Saleor (Headless e-commerce built on Django & Python)
- **Status:** *Deprecated/Inactive*. The folder remains for historical context or local tests, but the web frontend no longer connects to it. 

## Local Development Flow
To run the project locally:
1. Navigate to `web/`.
2. Start the local Supabase container: `npx supabase start` (first run takes 5-10 mins to pull images).
3. Start the Next.js development server: `npm run dev`.
4. Access the web app at `http://localhost:3000`.

## Future Milestones & Work
- **SMS Integration:** Drop in a real SMS provider for OTP functionality (currently stubbed in `src/lib/actions/otp.ts`).
- **Abandoned Cart:** Implement cron jobs and email providers to remind users about abandoned carts.

## General Guidelines
- Ensure new storefront UI components follow the existing design system and correctly implement responsive mobile and desktop variants.
- Assume all data querying goes through Supabase using the Supabase SDK.
