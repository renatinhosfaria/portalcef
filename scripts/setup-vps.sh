#!/bin/bash
# =============================================================================
# Setup Script - VPS Contabo
# Portal Digital Colégio Essência Feliz
# Domain: portalcef.com.br | IP: 144.126.134.23
# =============================================================================
# Usage: 
#   1. Copy this script to your VPS: scp scripts/setup-vps.sh root@144.126.134.23:/root/
#   2. Connect via SSH: ssh root@144.126.134.23
#   3. Run: chmod +x setup-vps.sh && ./setup-vps.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Check if running as root
# =============================================================================
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root"
    exit 1
fi

echo -e "${GREEN}"
echo "=============================================="
echo "  Portal Essência Feliz - VPS Setup Script"
echo "  Domain: portalcef.com.br"
echo "=============================================="
echo -e "${NC}"

# =============================================================================
# Step 1: Update System
# =============================================================================
print_step "Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

# =============================================================================
# Step 2: Install Docker
# =============================================================================
print_step "Installing Docker..."
if command -v docker &> /dev/null; then
    print_warning "Docker already installed, skipping..."
else
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    print_success "Docker installed"
fi

# Verify Docker
docker --version

# =============================================================================
# Step 3: Install Docker Compose Plugin
# =============================================================================
print_step "Installing Docker Compose Plugin..."
apt install -y docker-compose-plugin
docker compose version
print_success "Docker Compose Plugin installed"

# =============================================================================
# Step 4: Install Git
# =============================================================================
print_step "Installing Git..."
apt install -y git
print_success "Git installed"

# =============================================================================
# Step 5: Configure UFW Firewall
# =============================================================================
print_step "Configuring UFW Firewall..."
apt install -y ufw

# Allow SSH first (important!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable UFW
echo "y" | ufw enable

print_success "Firewall configured (ports 22, 80, 443)"
ufw status

# =============================================================================
# Step 6: Install Fail2Ban
# =============================================================================
print_step "Installing Fail2Ban..."
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
print_success "Fail2Ban installed and running"

# =============================================================================
# Step 7: Configure Swap (for builds)
# =============================================================================
print_step "Configuring Swap (4GB for builds)..."
if [ -f /swapfile ]; then
    print_warning "Swap already exists, skipping..."
else
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    print_success "4GB Swap configured"
fi

# =============================================================================
# Step 8: Create Application Directory
# =============================================================================
print_step "Creating application directory..."
mkdir -p /opt/essencia
cd /opt/essencia
print_success "Directory /opt/essencia created"

# =============================================================================
# Step 9: Clone Repository
# =============================================================================
print_step "Cloning repository from GitHub..."
if [ -d "/opt/essencia/.git" ]; then
    print_warning "Repository already exists, pulling latest..."
    git pull origin main
else
    git clone https://github.com/renatinhosfaria/portalcef.git .
    print_success "Repository cloned"
fi

# =============================================================================
# Step 10: Generate Secrets and Create .env
# =============================================================================
print_step "Generating secure secrets..."

POSTGRES_PASSWORD=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
MINIO_PASSWORD=$(openssl rand -hex 32)

if [ -f "/opt/essencia/.env" ]; then
    print_warning ".env file already exists, backing up to .env.backup"
    cp /opt/essencia/.env /opt/essencia/.env.backup
fi

cat > /opt/essencia/.env << EOF
# =============================================================================
# Portal Essência Feliz - Production Environment
# Generated on: $(date)
# =============================================================================

# Domain
DOMAIN=portalcef.com.br
ACME_EMAIL=admin@portalcef.com.br

# Database
POSTGRES_USER=essencia
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=essencia_db
DATABASE_URL=postgresql://essencia:${POSTGRES_PASSWORD}@postgres:5432/essencia_db

# Redis
REDIS_URL=redis://redis:6379

# Session & Cookies
COOKIE_SECRET=${COOKIE_SECRET}
COOKIE_DOMAIN=.portalcef.com.br
SESSION_TTL_HOURS=24
SESSION_RENEWAL_THRESHOLD=0.25

# API
API_INTERNAL_URL=http://api:3001
NEXT_PUBLIC_API_URL=https://api.portalcef.com.br

# MinIO Storage
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
MINIO_BUCKET=essencia-bucket

# Traefik Dashboard (disabled by default)
TRAEFIK_AUTH=

# Node
NODE_ENV=production
EOF

print_success ".env file created with generated secrets"

# =============================================================================
# Step 11: Create SSL Certificate Directory
# =============================================================================
print_step "Creating directories for Let's Encrypt..."
mkdir -p /opt/essencia/letsencrypt
print_success "Let's Encrypt directory created"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}=============================================="
echo "  SETUP COMPLETE!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure DNS at Registro.br:"
echo "   - Type: A | Name: @ | Value: 144.126.134.23"
echo "   - Type: A | Name: * | Value: 144.126.134.23"
echo "   - Type: A | Name: api | Value: 144.126.134.23"
echo "   - Type: A | Name: storage | Value: 144.126.134.23"
echo ""
echo "2. Wait for DNS propagation (5-30 minutes)"
echo ""
echo "3. Deploy the application:"
echo "   cd /opt/essencia"
echo "   ./scripts/deploy.sh"
echo ""
echo -e "${GREEN}Server IP: $(hostname -I | awk '{print $1}')${NC}"
echo -e "${GREEN}Domain: portalcef.com.br${NC}"
echo ""
echo "=== IMPORTANT: Save these generated secrets ==="
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo "COOKIE_SECRET=${COOKIE_SECRET}"
echo "MINIO_PASSWORD=${MINIO_PASSWORD}"
echo "================================================"
echo ""
