# Correção do Fluxo de Deploy Local — Plano de Implementação

> **Para execução:** usar a skill `superpowers:executing-plans` para executar este plano tarefa por tarefa.

**Objetivo:** tornar o deploy local de produção reproduzível, versionado por commit e seguro contra execução de migration na imagem errada.

**Arquitetura:** um script de orquestração valida o ambiente, executa as verificações de qualidade, constrói todas as imagens com uma tag derivada do commit, executa opcionalmente backup e migration nessa mesma tag, sobe os serviços com `IMAGE_TAG` explícito e roda o health check. A documentação passa a apontar para esse fluxo único; a integração do deploy rolling com o registry permanece pendente e não é recomendada para build local.

**Tecnologias:** Bash, Docker Buildx Bake, Docker Compose, pnpm/Turbo.

---

### Tarefa 1: Especificar o comportamento do orquestrador

**Arquivos:**
- Criar: `scripts/deploy.test.sh`
- Criar: `scripts/deploy.sh`
- Criar: `scripts/health-check.test.sh`
- Modificar: `scripts/health-check.sh`

**Passos:**
1. Escrever testes com executáveis falsos para `pnpm`, `docker`, `git` e health check.
2. Verificar que os testes falham antes da implementação.
3. Implementar o fluxo estrito com validação de `.env.docker`, árvore limpa, tag do commit, lint, typecheck, Bake com `--load`, build da `landing-mae`, migration opcional com backup e `up` com `IMAGE_TAG` explícito.
4. Verificar que os testes passam e que a tag é propagada para Bake, migration e Compose.
5. Corrigir o health check para usar `.env.docker`, listar containers parados, detectar estados `unhealthy` exatos e falhar quando nenhum container for encontrado.
6. Verificar o teste isolado do health check.

### Tarefa 2: Alinhar a documentação

**Arquivos:**
- Modificar: `AGENTS.md`
- Modificar: `docs/DEPLOYMENT.md`

**Passos:**
1. Documentar `./scripts/deploy.sh` como fluxo recomendado para build local.
2. Explicar que `deploy-rolling.sh` pressupõe imagens disponíveis no registry e executa `pull`.
3. Remover exemplos que executam Compose sem `--env-file` ou que misturam `latest` com a tag do commit.

### Tarefa 3: Validar

**Passos:**
1. Executar `bash scripts/deploy.test.sh`.
2. Executar `pnpm turbo lint`.
3. Executar `pnpm turbo typecheck`.
4. Verificar o diff e a sintaxe dos scripts com `bash -n`.
