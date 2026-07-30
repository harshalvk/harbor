.PHONY: run migrate-up migrate-down tidy

run:
	go run ./cmd/server

tidy:
	go mod tidy

# Requires golang-migrate CLI: https://github.com/golang-migrate/migrate
migrate-up:
	migrate -path migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path migrations -database "$(DATABASE_URL)" down 1
