.PHONY: help run build test clean deps fmt lint docker-build docker-run

# Variables
APP_NAME=chat-service
BINARY_NAME=chat-service
MAIN_PATH=./cmd/main.go

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

run: ## Run the application
	@echo "Running $(APP_NAME)..."
	go run $(MAIN_PATH)

build: ## Build the application
	@echo "Building $(APP_NAME)..."
	go build -o bin/$(BINARY_NAME) $(MAIN_PATH)
	@echo "Build complete: bin/$(BINARY_NAME)"

build-linux: ## Build for Linux
	@echo "Building for Linux..."
	GOOS=linux GOARCH=amd64 go build -o bin/$(BINARY_NAME)-linux $(MAIN_PATH)
	@echo "Build complete: bin/$(BINARY_NAME)-linux"

test: ## Run tests
	@echo "Running tests..."
	go test -v ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy
	@echo "Dependencies downloaded"

fmt: ## Format code
	@echo "Formatting code..."
	go fmt ./...
	@echo "Code formatted"

lint: ## Run linter
	@echo "Running linter..."
	golangci-lint run
	@echo "Linting complete"

clean: ## Clean build artifacts
	@echo "Cleaning..."
	rm -rf bin/
	rm -f coverage.out coverage.html
	@echo "Cleaned"

dev: ## Run in development mode with hot reload (requires air)
	@echo "Running in development mode..."
	air

install-tools: ## Install development tools
	@echo "Installing development tools..."
	go install github.com/air-verse/air@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "Tools installed"

docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t $(APP_NAME):latest .
	@echo "Docker image built: $(APP_NAME):latest"

docker-run: ## Run Docker container
	@echo "Running Docker container..."
	docker run -p 8080:8080 --env-file .env $(APP_NAME):latest

docker-compose-up: ## Start with docker-compose
	@echo "Starting services with docker-compose..."
	docker-compose up -d
	@echo "Services started"

docker-compose-down: ## Stop docker-compose services
	@echo "Stopping services..."
	docker-compose down
	@echo "Services stopped"

.DEFAULT_GOAL := help