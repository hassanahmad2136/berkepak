### PRODUCT REQUIREMENTS DOCUMENT

### Infrastructure Migration & Platform Unification

### Saleor Deprecation → Supabase Unified Architecture

| **Document Version** | **1.0 — APPROVED FOR EXECUTION** |
| --- | --- |
| **Date Issued** | May 24, 2026 |
| **Owner** | Office of the CTO / Principal Architecture |
| **Addressee** | AI Engineer — Implementation Lead |
| **Status** | **ACTIVE — Do Not Defer** |

### 01  CTO STRATEGIC DIRECTIVE

> [!NOTE]
> **Strategic Rationale** | You have already built the hardest parts of a production e-commerce platform — auth, real-time inventory, orders, and receipt storage — natively on Supabase. Saleor now serves exclusively as a static product metadata store (PIM), and its continued operation introduces infrastructure overhead, dual-API latency, and split-brain data risk with zero commensurate upside.
>          <br>          <br> **This is not a refactor. This is an infrastructure clean-up sprint. The architectural decision has been made at the CTO level and is approved for immediate execution.**

### Business Outcome Goals
- Eliminate **all** VPS/Docker infrastructure costs by end of this sprint
- Reduce storefront data latency by removing the dual-API pattern (Saleor + Supabase)
- Achieve a single source of truth for all product and transactional data in Supabase
- Reduce system complexity from 6+ managed services to 2 (Vercel + Supabase)
- Zero downtime during the cutover — the storefront must remain live throughout

### What Is NOT In Scope
- No new product features or UI redesign during this sprint
- No changes to Auth, Orders, Receipts, or Wishlists — these are already correct
- No change to Next.js frontend framework or Vercel hosting

### 02  ARCHITECTURE: CURRENT → TARGET STATE

| **Component** | **Current State** | **Target State** | **Action Required** |
| --- | --- | --- | --- |
| **Product Catalog** | **Saleor (Django/PG)** | **Supabase PostgreSQL** | **Migrate & Decommission** |
| **Inventory / Stock** | **Supabase (product_colors)** | **Supabase (unchanged)** | **FK link to new catalog** |
| **Data API Layer** | **Apollo / GraphQL** | **Supabase JS SDK** | **Refactor Next.js layer** |
| **Auth** | **Supabase Auth** | **Supabase Auth (no change)** | **No action needed** |
| **Orders / Receipts** | **Supabase** | **Supabase (no change)** | **No action needed** |
| **Hosting / Compute** | **VPS + Docker + Vercel** | **Vercel only (serverless)** | **Teardown VPS + Docker** |
| **Background Tasks (Celery)** | **Redis + Celery Worker** | **Audit → Edge Fn / Vercel Cron** | **Audit BEFORE teardown** |
| **State Consistency** | **Split / Eventual** | **ACID / Single Source** | **Achieved post-migration** |

> [!WARNING]
> **⚠  Critical Pre-Condition: Celery Audit**
>          <br> Before any teardown is initiated, the engineer MUST produce a written audit of all active Celery tasks. If any task handles transactional logic (email dispatch, order status hooks, payment webhooks), a Supabase Edge Function or Vercel Cron replacement must be built and validated BEFORE the VPS is decommissioned. This is a hard gate — do not skip.

### 03  DATABASE SCHEMA SPECIFICATION

### 3.1  New Table: product_catalog

Create this table in the existing Supabase project. This table replaces the Saleor product layer entirely.

| **Column** | **Type** | **Constraints** | **Notes** |
| --- | --- | --- | --- |
| `id` | `UUID` | PK, gen_random_uuid() | Auto-generated primary key |
| `slug` | `TEXT` | UNIQUE, NOT NULL | URL-safe identifier for routing |
| `name` | `TEXT` | NOT NULL | Display name of the fabric |
| `category` | `TEXT` | NOT NULL | e.g. Cotton, Blended, Wash & Wear |
| `weave_type` | `TEXT` |  | e.g. Plain, Twill, Oxford |
| `gsm` | `INTEGER` |  | Grams per square metre |
| `thread_count` | `INTEGER` |  | Thread count specification |
| `description` | `TEXT` |  | Long-form product description |
| `is_active` | `BOOLEAN` | DEFAULT true | Replaces Saleor visibility flag |
| `created_at` | `TIMESTAMPTZ` | DEFAULT now() | Audit trail |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT now() | Trigger-maintained |

### 3.2  Existing Table: product_colors (Updated FK)

This table already exists. The only change required is adding a foreign key constraint to product_catalog.id. No data migration required on this table.

| **Column** | **Type** | **Constraints** | **Notes** |
| --- | --- | --- | --- |
| `id` | `UUID` | PK | No change |
| `product_id` | `UUID` | FK → product_catalog.id | ADD THIS CONSTRAINT — was previously FK to Saleor |
| `color_name` | `TEXT` | NOT NULL | No change |
| `hex_code` | `TEXT` |  | No change |
| `stock_meters` | `DECIMAL` |  | No change |
| `stock_suits` | `INTEGER` |  | No change |

### 3.3  Row Level Security (RLS) Policies

Apply the following RLS policies immediately after table creation:

```sql
-- Enable RLS

 ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

 CREATE POLICY "public_read_active" ON product_catalog

   FOR SELECT USING (is_active = true);

 CREATE POLICY "admin_write" ON product_catalog

   FOR ALL USING (auth.role() = 'authenticated')

   WITH CHECK (auth.role() = 'authenticated');

 CREATE TRIGGER set_updated_at BEFORE UPDATE ON product_catalog

   FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

### 04  EXECUTION PHASES & ACCEPTANCE CRITERIA

> [!WARNING]
> **Order of Operations is Mandatory** | Each phase has a hard acceptance gate. Do not proceed to the next phase until the current phase's gate is met and confirmed in writing. Phases 4 and 5 are irreversible.

| **Phase 1: ****Celery Task Audit** | **GATE: Produce written audit report before any code changes** |
| --- | --- |
| **Task** | Enumerate all Celery tasks currently registered in the Django app |
| **Classify** | Tag each task as: (a) Order/Payment logic, (b) Email/notification, (c) Scheduled job, (d) Dead/unused |
| **Replace** | For any live task in categories (a) or (b): implement a Supabase Edge Function or Vercel Cron equivalent and test it in isolation |
| **Gate** | Produce a written task audit table. No infrastructure teardown proceeds until this is signed off by the project lead |

| **Phase 2: ****Initialize Catalog Schema in Supabase GATE: Schema live with RLS verified before any data porting**  --- |
| **Create Table** | Execute the product_catalog DDL from Section 3.1 in the Supabase SQL editor |
| **Add FK** | Add the product_id foreign key constraint to the existing product_colors table |
| **Apply RLS** | Execute all RLS policies from Section 3.3. Verify public read returns only is_active = true rows |
| **Verify** | Run a manual INSERT + SELECT cycle to confirm schema integrity. Confirm product_colors FK constraint is enforced |
| **Gate** | Schema exists in Supabase. product_colors FK is live. RLS returns correct results for anon and authenticated roles |

| **Phase 3: ****Data Porting — Saleor → Supabase GATE: 1:1 row count and field parity verified before frontend changes**  --- |
| **Write Script** | Build a one-off Node.js script that: (1) queries all products from Saleor's GraphQL API, (2) maps fields to product_catalog schema, (3) bulk-inserts into Supabase. The script must be idempotent — safe to re-run without duplicates |
| **Run Script** | Execute against production Saleor, targeting production Supabase project |
| **Verify Parity** | Run a row count check: Saleor product count must equal Supabase product_catalog count. Spot-check 5 records manually for field accuracy |
| **Map Colors** | For each color variant in Saleor, verify the product_id FK in product_colors now correctly references the new product_catalog.id |
| **Gate** | Row count matches 1:1. All product_colors rows have a valid product_id FK. Zero orphaned records |
| **⚠  Do NOT delete Saleor data at this stage. The VPS remains live as a read-only fallback until Phase 5 is complete.** |  |

| **Phase 4: ****Next.js Frontend Refactor GATE: Vercel preview environment passes all E2E tests before production deploy**  --- |
| **Branch** | Create branch: feature/supabase-catalog. All changes in this branch — no direct commits to main |
| **Refactor Data Layer** | In web/src/lib/products.ts — replace all Apollo/GraphQL calls to Saleor with supabase.from('product_catalog').select(...). Match all existing TypeScript interfaces exactly |
| **Update Fallback Catalog** | If a static fallback catalog exists, update its data types to align with the new Supabase schema fields |
| **Env Variables** | Remove SALEOR_API_URL and APOLLO_CLIENT config from .env. Confirm SUPABASE_URL and SUPABASE_ANON_KEY are present |
| **Deploy Preview** | Deploy branch to Vercel preview URL. Do NOT touch production yet |
| **E2E Test Checklist** | Verify: (a) product listing renders correctly, (b) individual product pages load with correct GSM/specs, (c) is_active = false products are hidden, (d) inventory deductions on checkout still work, (e) admin visibility toggling functions correctly |
| **Gate** | All checklist items pass on Vercel preview. Zero console errors. Zero 4xx/5xx API responses in Vercel logs |

| **Phase 5: ****Production Deploy & Infrastructure Teardown IRREVERSIBLE — Confirm all gates before executing**  --- |
| **Merge to Main** | Merge feature/supabase-catalog to main. Vercel auto-deploys to production |
| **Smoke Test Production** | Re-run E2E checklist against the live production URL. Confirm 100% pass rate |
| **Monitor 24h** | Leave VPS running for a minimum of 24 hours post-production deploy, monitoring for any unexpected traffic or errors |
| **Teardown VPS** | After 24h clean monitoring: (1) take a final pg_dump of the Saleor database and store in a private S3/GCS bucket as a permanent archive, (2) spin down the VPS, (3) delete Docker containers and images |
| **Decommission Saleor** | Cancel any cloud hosting or managed service accounts associated with the VPS. Update your infrastructure register |
| **Gate** | Production storefront fully operational on Supabase. VPS is terminated. Saleor database archive stored securely. No open Docker processes |
| **⚠  Take a Saleor pg_dump BEFORE shutting down the VPS. Store it in cold storage. This archive is your only rollback option.** |  |

### 05  API MIGRATION REFERENCE

### 5.1  Apollo / GraphQL → Supabase SDK Equivalents

```javascript
// BEFORE: Apollo/GraphQL query to Saleor

 const GET_PRODUCTS = gql`

   query { products(first: 100) {

     edges { node { id name slug attributes { attribute { name } values { name } } } }

   }}`;

 const { data, error } = await supabase

   .from('product_catalog')

   .select(`

     id, slug, name, category, weave_type, gsm, thread_count, description,

     product_colors ( id, color_name, hex_code, stock_meters, stock_suits )

   `)

   .eq('is_active', true);
```

```javascript
// BEFORE: Fetch single product by slug

 const GET_PRODUCT = gql`query GetProduct($slug: String!) {

   product(slug: $slug) { id name attributes { ... } }

 }`;

 const { data, error } = await supabase

   .from('product_catalog')

   .select('*, product_colors(*)')

   .eq('slug', slug)

   .eq('is_active', true)

   .single();
```

```javascript
// BEFORE: Toggle product visibility in Saleor (admin mutation)

 const UPDATE_VISIBILITY = gql`mutation UpdateProduct($id: ID!, $input: ProductInput!) {

   productUpdate(id: $id, input: $input) { product { isPublished } errors { ... } }

 }`;

 const { error } = await supabase

   .from('product_catalog')

   .update({ is_active: false })

   .eq('id', productId);
```

### 06  RISK REGISTER

| **Risk** | **Severity** | **Mitigation** | **Owner** |
| --- | --- | --- | --- |
| Data loss during porting script | **HIGH** | Run script as idempotent upsert. Verify 1:1 parity before proceeding. VPS remains live as fallback until Phase 5 | AI Engineer |
| Celery task has live transactional logic | **HIGH** | Phase 1 audit is mandatory. No teardown proceeds until replacement functions are live and tested | AI Engineer |
| Apollo type mismatch breaks Next.js | **MEDIUM** | Verify TypeScript interfaces match new Supabase schema. Run type-check before preview deploy | AI Engineer |
| Storefront downtime during cutover | **MEDIUM** | Phase 4 uses Vercel preview — production is untouched until E2E tests pass. Zero-downtime deploy via Vercel | AI Engineer |
| No rollback after VPS teardown | **LOW (mitigated)** | pg_dump of Saleor database stored in cold storage before any teardown. 24h monitoring window before VPS shutdown | AI Engineer |

### 07  DEFINITION OF DONE — SPRINT COMPLETION CRITERIA

```javascript
The sprint is complete when ALL of the following are verifiably true:
- ✓  product_colors table has a valid FK constraint to product_catalog.id
- ✓  All Saleor product data is present in Supabase with 1:1 row count parity
- ✓  Next.js frontend retrieves all product data exclusively from Supabase JS SDK — no Apollo client remains
- ✓  Vercel production deployment is fully operational and passes the E2E test checklist
- ✓  Celery audit is documented and all live tasks have verified replacements (or are confirmed dead)
- ✓  Saleor pg_dump is archived in cold storage
- ✓  VPS is terminated. Docker containers are deleted. No Saleor compute is running anywhere
- ✓  Infrastructure bill reflects zero VPS/Docker compute charges
```

### 08  APPENDIX — DATA PORTING SCRIPT SKELETON

The following is a reference skeleton for the Saleor → Supabase porting script. The engineer must adapt this to the actual Saleor schema and test thoroughly before running against production.

```javascript
// port-saleor-products.js  — Run once, idempotent

 // Usage: node port-saleor-products.js

 const SALEOR_URL = process.env.SALEOR_GRAPHQL_URL;

   query FetchAllProducts($after: String) {

     products(first: 100, after: $after) {

       pageInfo { hasNextPage endCursor }

       edges { node {

         id slug name category { name }

         attributes { attribute { name } values { name } }

         description isPublished

       }}

     }

   }`;

   let all = [], cursor = null, hasNext = true;

   while (hasNext) {

     const res = await fetch(SALEOR_URL, {

       method: 'POST', headers: { 'Content-Type': 'application/json' },

       body: JSON.stringify({ query: QUERY, variables: { after: cursor } }),

     });

     const { data } = await res.json();

     const page = data.products;

     all.push(...page.edges.map(e => e.node));

     hasNext = page.pageInfo.hasNextPage;

     cursor = page.pageInfo.endCursor;

   }

   return all;

 }

   const attr = (name) => p.attributes.find(a => a.attribute.name === name)

     ?.values[0]?.name ?? null;

   return {

     slug:         p.slug,

     name:         p.name,

     category:     p.category?.name ?? 'Uncategorized',

     weave_type:   attr('Weave Type'),

     gsm:          parseInt(attr('GSM')) || null,

     thread_count: parseInt(attr('Thread Count')) || null,

     description:  p.description ?? '',

     is_active:    p.isPublished,

   };

 }

   console.log('Fetching from Saleor...');

   const products = await fetchAllFromSaleor();

   console.log(`Fetched ${products.length} products from Saleor`);

   const { error } = await supabase.from('product_catalog')

     .upsert(rows, { onConflict: 'slug' });

   console.log(`Successfully upserted ${rows.length} products to Supabase`);

   const { count } = await supabase

     .from('product_catalog').select('*', { count: 'exact', head: true });

   console.log(`Supabase count: ${count} | Saleor count: ${products.length}`);

   console.log(count === products.length ? 'PARITY CHECK PASSED' : 'PARITY CHECK FAILED');

 }
```

###   DOCUMENT SIGN-OFF

| **Role** | **Name** | **Status** |
| --- | --- | --- |
| Principal Architect / CTO | Office of the CTO | **APPROVED** |
| Implementation Lead | AI Engineer | **PENDING EXECUTION** |
| Project Lead / QA | Abdullah Ahmad | **PENDING REVIEW** |

End of Document — Version 1.0 — Confidential
