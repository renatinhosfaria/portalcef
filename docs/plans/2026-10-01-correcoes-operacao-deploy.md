# Correções de Operação e Deploy — Plano de Implementação

> **Para o agente:** use a skill `superpowers:executing-plans` para executar este plano tarefa por tarefa.

**Objetivo:** tornar o ambiente de desenvolvimento e o fluxo de publicação previsíveis, cobrindo todos os serviços atuais e falhando de forma explícita quando a infraestrutura não estiver saudável.

**Arquitetura:** manter Docker Compose e os scripts existentes, corrigindo apenas nomes de volumes, manifests/portas, esperas de health check e gates de release. Os testes dos scripts usarão cópias temporárias e binários simulados, sem acessar a infraestrutura real.

**Tecnologias:** Bash, Docker Compose, Dockerfile, pnpm, Turborepo e testes shell existentes.

---

### Tarefa 1: Separar o armazenamento de desenvolvimento

**Arquivos:**
- Modificar: `docker-compose.dev.yml:136-186`
- Modificar: `scripts/dev-setup.sh:47-57`

**Passos:**
1. Criar teste shell que verifique nomes exclusivos dos volumes de desenvolvimento.
2. Executar o teste e confirmar falha com os nomes atuais.
3. Renomear volumes para `essencia-dev-postgres-data`, `essencia-dev-redis-data` e `essencia-dev-minio-data`.
4. Atualizar o script de setup para criar os mesmos nomes.
5. Executar o teste e confirmar aprovação.

### Tarefa 2: Incluir suporte e workflows no ambiente dev

**Arquivos:**
- Modificar: `docker-compose.dev.yml:136-149`
- Modificar: `docker/Dockerfile.dev:24-35,60-61`

**Passos:**
1. Adicionar teste shell que procure as portas 3013 e 3015 e os manifests dos dois apps.
2. Confirmar falha inicial.
3. Adicionar os manifests, portas e exposição dos apps ausentes.
4. Confirmar aprovação do teste.

### Tarefa 3: Tornar `dev-setup` determinístico

**Arquivos:**
- Criar: `scripts/dev-setup.test.sh`
- Modificar: `scripts/dev-setup.sh:65-79`

**Passos:**
1. Testar cenário em que um serviço nunca fica healthy e exigir saída não zero.
2. Confirmar falha inicial.
3. Substituir sleeps fixos por loop com timeout configurável e verificação final.
4. Testar cenário healthy e cenário timeout.

### Tarefa 4: Corrigir health check de produção

**Arquivos:**
- Modificar: `scripts/health-check.sh:96-138`
- Criar ou ajustar teste shell em `scripts/health-check.test.sh`

**Passos:**
1. Adicionar expectativas para `suporte`, `nginx`, `landing-mae` e demais serviços declarados no Compose.
2. Confirmar falha inicial.
3. Implementar as verificações internas/externas necessárias.
4. Executar o teste shell e validar a configuração do Compose.

### Tarefa 5: Alinhar timeout do rolling deploy

**Arquivos:**
- Modificar: `scripts/deploy-rolling.sh:27-33`
- Modificar: `scripts/deploy-rolling.test.sh`

**Passos:**
1. Adicionar teste que exija timeout mínimo de 180 segundos ou variável configurável.
2. Confirmar falha inicial.
3. Tornar o timeout configurável, com padrão de 180 segundos.
4. Executar a suíte do script.

### Tarefa 6: Adicionar testes ao deploy manual

**Arquivos:**
- Modificar: `scripts/deploy.sh:121-147`
- Modificar: `scripts/deploy.test.sh`

**Passos:**
1. Adicionar expectativa de chamada a `pnpm turbo test` no script simulado.
2. Confirmar falha inicial.
3. Inserir o gate de testes antes do build de imagens.
4. Executar todos os testes dos scripts.

### Tarefa 7: Validação final

**Passos:**
1. Rodar os testes shell específicos.
2. Rodar `docker compose -f docker-compose.dev.yml config` e `docker compose -f docker-compose.prod.yml --env-file .env.docker config` quando o ambiente permitir.
3. Rodar `pnpm turbo lint`.
4. Rodar `pnpm turbo typecheck`.
5. Rodar `pnpm turbo test`.
6. Revisar o diff e registrar limitações de validação Docker, se houver.

