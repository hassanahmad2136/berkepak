# Berke Pak — Saleor backend
# Use these targets to bring Saleor up the first time.

.DEFAULT_GOAL := help

help:
	@echo "Berke Pak Saleor backend"
	@echo ""
	@echo "  make up          Pull images and start all services in the background"
	@echo "  make init        Run migrations + populate demo data + create superuser (first run)"
	@echo "  make migrate     Run Django migrations only"
	@echo "  make seed        Populate Saleor with demo products + a default-channel (idempotent-ish)"
	@echo "  make superuser   Create an admin user for the dashboard"
	@echo "  make down        Stop services (preserves data)"
	@echo "  make nuke        Stop services AND delete all data (destructive)"
	@echo "  make logs        Tail logs from the API"
	@echo "  make ps          Show service status"

up:
	docker compose up -d

down:
	docker compose down

nuke:
	docker compose down -v

logs:
	docker compose logs -f api worker

ps:
	docker compose ps

migrate:
	docker compose run --rm api python3 manage.py migrate

seed:
	docker compose run --rm api python3 manage.py populatedb --createsuperuser

superuser:
	docker compose run --rm api python3 manage.py createsuperuser

init: up migrate seed
	@echo ""
	@echo "Saleor is up:"
	@echo "  GraphQL API:  http://localhost:8000/graphql/"
	@echo "  Dashboard:    http://localhost:9000  (login: admin@example.com / admin)"
	@echo "  Mailpit:      http://localhost:8025  (intercepted dev emails)"
