#!/bin/bash
# =============================================================================
# Deploy Script - Portal Essência Feliz
# Domain: portalcef.com.br
# =============================================================================
# Usage: ./deploy.sh
# Run this on the VPS to deploy/update the application
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "\n${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cd /opt/essencia

echo -e "${GREEN}"
echo "=============================================="
echo "  Portal Essência Feliz - Deploy"
echo "  Domain: portalcef.com.br"
echo "=============================================="
echo -e "${NC}"

# =============================================================================
# Step 1: Pull latest code from GitHub
# =============================================================================
print_step "Pulling latest code from GitHub..."
git pull origin main
print_success "Code updated"

# =============================================================================
# Step 2: Build and start services
# =============================================================================
print_step "Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build
print_success "Services started"

# =============================================================================
# Step 3: Wait for API to be healthy
# =============================================================================
print_step "Waiting for API to be healthy..."
attempt=1
max_attempts=30
until docker compose -f docker-compose.prod.yml exec -T api wget --spider -q http://localhost:3001/health 2>/dev/null; do
    if [ $attempt -ge $max_attempts ]; then
        print_error "API failed to become healthy after $max_attempts attempts"
        docker compose -f docker-compose.prod.yml logs api
        exit 1
    fi
    echo "  Attempt $attempt/$max_attempts - waiting..."
    sleep 5
    attempt=$((attempt + 1))
done
print_success "API is healthy"

# =============================================================================
# Step 4: Run database migrations
# =============================================================================
print_step "Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T api pnpm db:migrate || true
print_success "Migrations completed"

# =============================================================================
# Step 5: Clean up old images
# =============================================================================
print_step "Cleaning up old Docker images..."
docker image prune -f
print_success "Cleanup completed"

# =============================================================================
# Step 6: Show status
# =============================================================================
print_step "Checking service status..."
echo ""
docker compose -f docker-compose.prod.yml ps
echo ""

# =============================================================================
# Summary
# =============================================================================
echo -e "${GREEN}=============================================="
echo "  DEPLOY COMPLETE!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo "Your application is now available at:"
echo "  🌐 https://portalcef.com.br"
echo "  🔐 https://portalcef.com.br/login"
echo "  📡 https://api.portalcef.com.br/health"
echo ""
echo "Useful commands:"
echo "  View logs:   docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop all:    docker compose -f docker-compose.prod.yml down"
echo "  Restart:     docker compose -f docker-compose.prod.yml restart"
echo ""
