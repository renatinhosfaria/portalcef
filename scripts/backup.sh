#!/bin/bash
# =============================================================================
# Backup Script - Portal Essência Feliz
# Creates a backup of PostgreSQL database
# =============================================================================
# Usage: ./backup.sh
# Backups are saved to /opt/essencia/backups/
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_DIR="/opt/essencia/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/essencia_db_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p ${BACKUP_DIR}

echo -e "${BLUE}[BACKUP]${NC} Starting database backup..."

# Get database credentials from .env
source /opt/essencia/.env

# Create compressed backup
docker compose -f /opt/essencia/docker-compose.prod.yml exec -T postgres \
    pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} | gzip > ${BACKUP_FILE}

# Get file size
SIZE=$(du -h ${BACKUP_FILE} | cut -f1)

echo -e "${GREEN}[OK]${NC} Backup created: ${BACKUP_FILE} (${SIZE})"

# Keep only last 7 days of backups
echo -e "${BLUE}[CLEANUP]${NC} Removing backups older than 7 days..."
find ${BACKUP_DIR} -name "essencia_db_*.sql.gz" -mtime +7 -delete

echo -e "${GREEN}[OK]${NC} Backup complete!"
