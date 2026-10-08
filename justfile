# List available commands
default:
    @just --list

# Start the Jekyll development server
serve *ARGS:
    @echo "🚀 Starting Jekyll development server..."
    docker compose up --build {{ARGS}}

# Stop the Docker Compose services
down:
    docker compose down

# Follow the Docker Compose logs
logs:
    docker compose logs -f

# Remove containers and volumes, then rebuild and start the server
clean:
    docker compose down -v
    docker compose up --build

# Check the Jekyll site for configuration problems
doctor:
    docker compose exec labs64io-docs bundle exec jekyll doctor

# Build the static site once
build:
    docker compose run --rm labs64io-docs bundle exec jekyll build --config _config.yml

# Install Ruby dependencies
install:
    docker compose run --rm labs64io-docs bundle install
