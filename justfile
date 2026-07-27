# List available commands
default:
    @just --list

# Start the development server (use `just serve -d` to run in background)
serve *ARGS:
    @echo "🚀 Starting Jekyll development server..."
    docker compose up --build {{ARGS}}

# Stop the background service
down:
    docker compose down

# View logs
logs:
    docker compose logs -f

# Clean rebuild (clear cache)
clean:
    docker compose down -v
    docker compose up --build

# Run Jekyll doctor to check for issues
doctor:
    docker compose exec labs64io-docs bundle exec jekyll doctor

# Build the static site (one-off)
build:
    docker compose run --rm labs64io-docs bundle exec jekyll build --config _config.yml

# Install Ruby dependencies
install:
    docker compose run --rm labs64io-docs bundle install
