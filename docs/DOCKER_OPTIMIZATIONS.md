# 🚀 Otimizações de Docker - Portal Essência Feliz

## 📊 Análise de Performance (Build Anterior)

**Tempo total:** 682 segundos (11 minutos e 22 segundos)

### Gargalos Identificados

| Operação | Tempo (por imagem) | Total (10 imagens) | Severidade |
|----------|-------------------|-------------------|------------|
| **Unpacking to image** | 197s | ~33 minutos | 🔥 CRÍTICO |
| **chown -R /app** | 138.7s | ~23 minutos | 🔥 CRÍTICO |
| **Exporting layers** | 103.7s | ~17 minutos | 🟡 ALTO |
| **Turbo build** | 198s | 3 minutos | 🟢 NORMAL |
| **pnpm prune** | 1.5s | 15 segundos | 🟢 NORMAL |

**Tempo desperdiçado:** ~73 minutos em operações otimizáveis

---

## ✅ Otimizações Aplicadas

### 1. Eliminação do `chown -R` (IMPACTO: -138.7s por imagem)

**Problema:**
```dockerfile
# ❌ ANTES: chown recursivo em 879MB demora 138.7s
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app  # 138.7s! 🐌
```

**Solução:**
```dockerfile
# ✅ DEPOIS: Usar --chown no COPY (instantâneo)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps ./apps
COPY --from=builder --chown=nodejs:nodejs /app/services ./services
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
```

**Resultado esperado:** Redução de ~23 minutos (138.7s × 10 imagens)

---

### 2. Variáveis de Ambiente (IMPACTO: Elimina 16 WARNs)

**Problema:**
```
WARN[0000] The "MINIO_ACCESS_KEY" variable is not set. Defaulting to a blank string.
WARN[0000] The "POSTGRES_PASSWORD" variable is not set. Defaulting to a blank string.
... (16 warnings total)
```

**Solução:**
```bash
# Criado .env na raiz do projeto (carregado automaticamente pelo docker-compose)
# Docker Compose carrega .env antes de processar docker-compose.yml
```

**Resultado:** 0 warnings de variáveis não definidas

---

### 3. Volumes como External (IMPACTO: Elimina 3 WARNs)

**Problema:**
```
WARN[0682] volume "essencia-postgres-data" already exists but was not created by Docker Compose
```

**Solução:**
```yaml
# docker-compose.prod.yml
volumes:
  postgres_data:
    name: essencia-postgres-data
    external: true  # ← Marca como gerenciado externamente
```

**Resultado:** 0 warnings de volumes

---

### 4. Build Context Otimizado (IMPACTO: ~5-10s)

**Melhorias no `.dockerignore`:**
```gitignore
# Adicionado:
e2e/                    # Testes E2E (não necessários na imagem)
scripts/                # Scripts de deploy
.github/                # CI/CD configs
docker-compose*.yml     # Configs de compose
Dockerfile*             # Dockerfiles
nginx.conf              # Montado como volume
README.md               # Documentação
*.md                    # Todos os markdowns
```

**Resultado:** Build context menor = envio mais rápido para Docker daemon

---

## 📈 Resultados Esperados

| Métrica | Antes | Depois (Estimado) | Melhoria |
|---------|-------|-------------------|----------|
| **chown time** | 138.7s | 0s | **-138.7s por imagem** |
| **Total build (10 imgs)** | 682s | ~400s | **-282s (41% mais rápido)** |
| **Warnings** | 19 | 0 | **100% eliminados** |
| **Build context** | ~5-10s | ~3-5s | **~50% redução** |

---

## 🧪 Como Validar as Otimizações

### Teste de Build Limpo (sem cache)

```bash
# Build de uma imagem específica
time docker compose -f docker-compose.prod.yml build api --no-cache

# Build de todas as imagens
time docker compose -f docker-compose.prod.yml build --no-cache
```

### Métricas a Observar

1. **Tempo de chown:** Deve desaparecer dos logs
2. **Warnings:** Nenhum WARN sobre variáveis ou volumes
3. **Build context transfer:** Deve ser < 1MB (antes: ~5MB)
4. **Tempo total:** Deve ser ~400s vs 682s anterior

---

## 🔄 Próximas Otimizações (Futuras)

### 1. BuildKit Inline Cache (Médio Impacto)

Reutilizar layers entre builds usando cache registry:

```yaml
# docker-compose.prod.yml
services:
  api:
    build:
      cache_from:
        - type=registry,ref=ghcr.io/essencia/api:cache
      cache_to:
        - type=inline
```

**Benefício:** Builds subsequentes ~70% mais rápidos

---

### 2. Build Matrix (Alto Impacto para CI/CD)

Buildar serviços em paralelo (já acontece localmente, mas pode otimizar no CI):

```yaml
# .github/workflows/build.yml
strategy:
  matrix:
    service: [api, home, login, usuarios, escolas, turmas, planejamento, loja, loja-admin, calendario]
```

**Benefício:** Build time total reduz para ~198s (tempo do serviço mais lento)

---

### 3. Separate Dockerfiles per Type (Médio Impacto)

Criar Dockerfile específico para NestJS e Next.js:

```
Dockerfile.nextjs    # Para apps Next.js (9 serviços)
Dockerfile.nestjs    # Para API NestJS (1 serviço)
```

**Benefício:** Images Next.js podem ser ~200MB menores (removendo deps da API)

---

### 4. Multi-Stage com Dependency Cache (Alto Impacto)

Cachear pnpm store entre builds:

```dockerfile
# Stage de cache de dependências
FROM base AS deps-cache
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
```

**Benefício:** pnpm install de 60s → 5s em builds subsequentes

---

## 📝 Comandos Úteis

```bash
# Build completo otimizado
pnpm turbo lint && \
pnpm turbo typecheck && \
docker compose -f docker-compose.prod.yml up -d --build

# Build apenas uma imagem (para testes)
docker compose -f docker-compose.prod.yml build api --no-cache

# Ver tamanho das imagens
docker images | grep essencia

# Limpar cache de build (se necessário)
docker builder prune -af

# Ver tempo de cada layer do build
docker compose -f docker-compose.prod.yml build api --progress=plain 2>&1 | grep '\[builder'
```

---

## 🎯 Checklist de Validação

Após aplicar otimizações, verificar:

- [ ] Build completa em < 500s (antes: 682s)
- [ ] Zero warnings de variáveis/volumes
- [ ] chown não aparece nos logs de build
- [ ] Imagens finais mantêm 879MB (não aumentaram)
- [ ] Containers startam normalmente
- [ ] Aplicação funciona corretamente
- [ ] Nginx resolve DNS dinamicamente (sem 502)

---

## 📚 Referências

- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [BuildKit Cache Backends](https://docs.docker.com/build/cache/backends/)
- [Docker --chown flag](https://docs.docker.com/engine/reference/builder/#copy---chown---chmod)
- [Nginx Dynamic DNS Resolution](http://nginx.org/en/docs/http/ngx_http_core_module.html#resolver)

---

<div align="center">

**Portal Digital Colégio Essência Feliz**
Otimizações aplicadas em: **Janeiro 2026**

</div>
