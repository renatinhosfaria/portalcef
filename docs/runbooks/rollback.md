# Runbook de rollback

Use este procedimento quando uma release recém-publicada falhar no health,
login, isolamento de tenant, pedidos, PDFs ou tarefas assíncronas.

## Antes de começar

1. Identifique o SHA da release atual e o último SHA saudável.
2. Confirme que a imagem anterior existe localmente ou no registry.
3. Verifique se a release aplicou migration. Rollback de imagem não desfaz banco.
4. Registre horário, sintoma, correlation IDs e responsável pela decisão.

## Rollback de código

Para imagem já presente no host:

```bash
ROLLBACK_ASSUME_YES=1 ./scripts/rollback.sh --local <sha-saudavel>
```

Para imagem que precisa ser obtida do registry:

```bash
ROLLBACK_ASSUME_YES=1 ./scripts/rollback.sh --registry <sha-saudavel>
```

O script usa `IMAGE_TAG` explícita, `.env.docker`, impede `latest` e executa o
health gate. Não use `docker compose up` manual sem esses parâmetros.

## Banco de dados

Restaure backup somente quando a migration for incompatível com a imagem
anterior e depois de interromper escritas. Confirme que o arquivo é não vazio,
foi criado pelo fluxo de migration e pertence à janela da release.

```bash
cat backup_pre_migration.sql | docker exec -i essencia-postgres \
  psql -U essencia_prod -d essencia_db
```

Migrations expansíveis e compatíveis não devem ser revertidas apenas porque o
código foi revertido.

## Validação posterior

```bash
./scripts/health-check.sh
docker compose -f docker-compose.prod.yml --env-file .env.docker ps
```

Valide login/logout, `/api/health`, leitura de uma tela autenticada, fila de PDF
e consulta de pedido. Mantenha a release defeituosa fora de tráfego e preserve
logs até concluir a análise de causa.
