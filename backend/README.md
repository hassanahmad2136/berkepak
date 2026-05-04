# Berke Pak — Saleor Backend

Headless e-commerce engine. Provides a GraphQL API for products, variants,
inventory, customers, and orders. The Next.js storefront in `../web/` will
consume this once the catalog is migrated off the static fixture.

## Services in this compose

| Service     | Port  | Purpose                                          |
|-------------|-------|--------------------------------------------------|
| `api`       | 8000  | Saleor core (Django) — GraphQL at `/graphql/`    |
| `dashboard` | 9000  | Saleor admin UI                                  |
| `db`        | 5433  | Postgres 15 (host port `5433` to avoid conflict) |
| `redis`     | —     | Cache + Celery broker                            |
| `worker`    | —     | Celery worker for async tasks                    |
| `mailpit`   | 8025  | Catches outbound dev email at <http://localhost:8025> |

## First-time setup

```bash
cd BerkePak/backend
make init
```

That runs `docker compose up -d`, applies Django migrations, and seeds a demo
catalog plus a superuser (`admin@example.com` / `admin`).

First run pulls ~2 GB of images and takes 5–10 minutes.

## Day-to-day

```bash
make up        # start
make down      # stop (keeps data)
make logs      # tail api + worker
make ps        # status
make nuke      # destroy volumes (resets all data)
```

## Once Saleor is running

1. Open the dashboard at <http://localhost:9000> and log in with the seeded
   superuser (`admin@example.com` / `admin`). **Change the password
   immediately.**
2. Generate an app token: Configuration → Apps → Create App → grant
   `MANAGE_PRODUCTS`, `MANAGE_ORDERS`, `MANAGE_CHECKOUTS` scopes. Copy the token.
3. Point the storefront at this Saleor instance by adding to
   `BerkePak/web/.env.local`:
   ```
   NEXT_PUBLIC_SALEOR_API_URL=http://localhost:8000/graphql/
   SALEOR_APP_TOKEN=<token from step 2>
   ```
4. Replace the static catalog (`web/src/lib/products.ts`) with Saleor GraphQL
   queries. *(Not yet wired — coming in the next phase.)*

## Production checklist (do not skip)

- Replace `SECRET_KEY` and `RSA_PRIVATE_KEY` with real values
  (`openssl genrsa 2048` for the RSA key).
- Strong DB password. Move to a managed Postgres (RDS, Cloud SQL, Supabase).
- Set `DEBUG=False`.
- Pin image tags to a specific digest, not just `:3.20`.
- Run behind HTTPS — Saleor sets secure cookies only over HTTPS.
- Wire real SMTP (SendGrid / SES / Postmark) — drop Mailpit.
- Object storage for media (S3 / GCS) — `MEDIA_URL` + `STATIC_URL` env vars.
