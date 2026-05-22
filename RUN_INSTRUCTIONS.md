# BerkePak Local Development Guide

## Quick Start
To get both the Frontend (Next.js) and Backend (Saleor via Docker) up and running locally, follow these commands.

### 1. Run the Backend (Saleor)
The backend uses Docker Compose to run the Saleor API, PostgreSQL database, Redis, and Mailpit.
Open a new terminal window, navigate to the `backend` directory, and run:
```bash
cd backend
docker compose up -d
```
*Note: If this is your first time, you may also need to run migrations and seed the database using `docker compose run --rm api python3 manage.py migrate` and `docker compose run --rm -v $(pwd)/seed_ratelist.py:/app/seed_ratelist.py -e DJANGO_SETTINGS_MODULE=saleor.settings api python3 /app/seed_ratelist.py`.*

### 2. Run the Frontend (Next.js)
The frontend is a Next.js application. Open another terminal window, navigate to the `web` directory, and start the development server:
```bash
cd web
npm install
npm run dev
```

---

## Local Access Links

Once both the Frontend and Backend are running, you can access the application at the following links:

* **Frontend Web App (Storefront):** [http://localhost:3000](http://localhost:3000)
* **Backend GraphQL API (Saleor Core):** [http://localhost:8000/graphql/](http://localhost:8000/graphql/)
* **Local Mail Inbox (Mailpit for capturing emails):** [http://localhost:8025](http://localhost:8025)
* **Backend Admin Panel (Saleor Dashboard):** [http://localhost:9000/](http://localhost:9000/)

## Troubleshooting
- If the cart defaults to showing empty product names or breaks, ensure the Next.js cache isn't stale. You can clear the cart from the UI to fetch the fresh database variant IDs.
- To restart the backend containers to apply any quick DB fixes:
  ```bash
  cd backend
  docker compose restart api worker
  ```
