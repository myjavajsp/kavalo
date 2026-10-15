.PHONY: install build up down migrate seed deploy

install:
	npm install

build:
	npm run build

up:
	docker compose up -d

down:
	docker compose down

migrate:
	npm run migrate

seed:
	npm run seed

deploy:
	./deploy.sh
