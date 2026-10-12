NPM = npm --prefix backend

SCRIPT_ENV = ./scripts/setup-env.sh
SCRIPT_CERTS = ./scripts/setup-certs.sh
COMPOSE = docker compose -f ./docker-compose.yml

# Rootless Docker cannot publish ports below 1024, so use 8443/8080 there.
# HTTPS_PORT / HTTP_PORT can also be set in .env or on the command line.
ROOTLESS := $(shell docker info --format '{{join .SecurityOptions " "}}' 2>/dev/null | grep -q rootless && echo yes)
ENV_HTTPS_PORT := $(shell grep -s '^HTTPS_PORT=' .env | cut -d= -f2)
ifeq ($(ROOTLESS)$(ENV_HTTPS_PORT),yes)
HTTPS_PORT ?= 8443
HTTP_PORT ?= 8080
export HTTPS_PORT HTTP_PORT
endif
PUBLIC_PORT := $(or $(HTTPS_PORT),$(ENV_HTTPS_PORT),443)
URL := https://localhost$(if $(filter 443,$(PUBLIC_PORT)),,:$(PUBLIC_PORT))

all: setup build up wait
	@echo ""
	@echo "Transcendence is running at $(URL)"
	@echo "Admin login: $$(grep -s '^ADMIN_EMAIL=' .env | cut -d= -f2) / $$(grep -s '^ADMIN_PASSWORD=' .env | cut -d= -f2)"

# Creates .env (random secrets) and the TLS certificates if they are missing.
setup:
	@$(SCRIPT_ENV)
	@$(SCRIPT_CERTS)

build: setup
	@echo "Building images..."
	$(COMPOSE) build

up: setup
	@echo "Upping all the containers..."
	$(COMPOSE) up -d

# Waits (max 5 min) until nginx reports healthy, i.e. the whole chain is up.
wait:
	@echo "Waiting for the services to be ready..."
	@for i in $$(seq 1 150); do \
		if [ "$$(docker inspect -f '{{.State.Health.Status}}' nginx 2>/dev/null)" = "healthy" ]; then exit 0; fi; \
		sleep 2; \
	done; \
	echo "Services are still starting, check them with 'make ps'"

down:
	@echo "Stopping and removing containers..."
	$(COMPOSE) down

ps:
	$(COMPOSE) ps

# Local development without Docker for the backend (needs Node.js).
deps:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	cd backend && npx prisma generate

dev:
	@echo "Iniciando localmente em modo de desenvolvimento..."
	$(NPM) run start:dev

# Only touches this project's containers, images and volumes.
clean:
	@echo "Cleaning Docker..."
	@rm -rf backend/dist frontend/dist
	$(COMPOSE) down --remove-orphans

fclean:
	@echo "Full cleaning (containers, images, volumes, certificates)..."
	$(COMPOSE) down -v --rmi local --remove-orphans
	@rm -rf backend/dist frontend/dist
	@# Files written by containers may belong to root: remove them from a container.
	@rm -rf nginx/certs vault/certs 2>/dev/null || \
		docker run --rm -v "$(CURDIR):/project" alpine rm -rf /project/nginx/certs /project/vault/certs

logs:
	@echo "Check specific service logs (ex: make logs SERVICE=backend)"
	$(COMPOSE) logs -f $(SERVICE)

update:
	@echo "Updating everything and bringing all containers up to date..."
	@$(SCRIPT_ENV)
	@$(SCRIPT_CERTS)
	$(COMPOSE) build
	$(COMPOSE) up -d --remove-orphans
	@echo "Transcendence updated and running!"

exec:
	@echo "Entering on the container (ex: make exec SERVICE=backend)"
	$(COMPOSE) exec $(SERVICE) sh

re: fclean all
	@echo "Restarting all the containers..."

.PHONY: all setup build up wait down ps deps dev clean fclean logs update exec re
