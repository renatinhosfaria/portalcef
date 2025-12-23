#!/bin/bash
# =============================================================================
# Health Check Script
# Portal Digital Colégio Essência Feliz
# =============================================================================
# Usage: ./health-check.sh
# Run this on the VPS to check the status of all services
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=============================================="
echo "  Portal Essência Feliz - Health Check"
echo -e "==============================================${NC}"
echo ""

# Check Docker containers
echo -e "${BLUE}[Docker Containers]${NC}"
docker compose -f /opt/essencia/docker-compose.prod.yml ps
echo ""

# Check API health
echo -e "${BLUE}[API Health]${NC}"
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is healthy${NC}"
else
    echo -e "${RED}✗ API is not responding${NC}"
fi

# Check Web
echo -e "${BLUE}[Web Portal]${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Web is healthy${NC}"
else
    echo -e "${RED}✗ Web is not responding${NC}"
fi

# Check PostgreSQL
echo -e "${BLUE}[PostgreSQL]${NC}"
if docker exec essencia-postgres pg_isready -U essencia > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is healthy${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not responding${NC}"
fi

# Check Redis
echo -e "${BLUE}[Redis]${NC}"
if docker exec essencia-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is healthy${NC}"
else
    echo -e "${RED}✗ Redis is not responding${NC}"
fi

# Disk usage
echo ""
echo -e "${BLUE}[Disk Usage]${NC}"
df -h / | tail -1

# Memory usage
echo ""
echo -e "${BLUE}[Memory Usage]${NC}"
free -h | head -2

echo ""
echo -e "${GREEN}Health check complete!${NC}"
