#!/bin/bash
# scripts/backup-pre-migracao-periodos.sh
# Backup completo do banco antes da migração de períodos

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/pre-migracao-periodos_$TIMESTAMP.sql"

echo "🔒 Criando backup pré-migração..."

mkdir -p $BACKUP_DIR

# Backup completo do banco
docker exec essencia-postgres pg_dump -U essencia -d essencia_db > $BACKUP_FILE

echo "✅ Backup criado: $BACKUP_FILE"
echo "📊 Tamanho: $(du -h $BACKUP_FILE | cut -f1)"

# Backup específico das tabelas afetadas
TABLES_BACKUP="$BACKUP_DIR/tables-afetadas_$TIMESTAMP.sql"
docker exec essencia-postgres pg_dump -U essencia -d essencia_db \
  -t plano_aula \
  -t plano_aula_historico \
  -t plano_aula_comentarios \
  -t quinzena_documents \
  > $TABLES_BACKUP

echo "✅ Backup de tabelas afetadas: $TABLES_BACKUP"
echo "📊 Tamanho: $(du -h $TABLES_BACKUP | cut -f1)"

echo ""
echo "🎯 Backups criados com sucesso!"
echo "   - Backup completo: $BACKUP_FILE"
echo "   - Tabelas afetadas: $TABLES_BACKUP"
echo ""
echo "⚠️  Guarde estes arquivos em local seguro antes de prosseguir com a migração"
