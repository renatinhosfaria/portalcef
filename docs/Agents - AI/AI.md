# AGENTS.md (Referencia Rapida)

Este arquivo e um resumo. **Fonte de verdade:** `AGENTS.md` na raiz do repositorio.

---

## Portas (Dev)

| Servico      | Porta |
| ------------ | ----- |
| home         | 3000  |
| calendario   | 3002  |
| login        | 3003  |
| usuarios     | 3004  |
| escolas      | 3005  |
| turmas       | 3006  |
| planejamento | 3007  |
| loja         | 3010  |
| loja-admin   | 3011  |
| api          | 3001  |

---

## Guardrails Principais

- Apps **nunca** acessam `packages/db` diretamente.
- Identidade do tenant vem da sessao (`userId`, `schoolId`, `unitId`, `stageId`, `role`).
- Cadeia de guards: `AuthGuard -> RolesGuard -> TenantGuard`.

---

## Documentacao Obrigatoria

| Mudanca                       | Documento |
| ----------------------------- | --------- |
| Novo endpoint / alteracao API | `docs/API.md` |
| Alteracao de schema           | `docs/DATABASE.md` |
| Mudanca em auth/RBAC/sessao   | `docs/SECURITY.md` |
| Mudanca em deploy/infra       | `docs/DEPLOYMENT.md` |
| Modulo loja                   | `docs/MODULO_LOJA.md` |
| Changelog                     | `docs/CHANGELOG.md` |

---

## CI/CD

Nao ha workflows versionados no repo. Use o ciclo de qualidade local:

```bash
pnpm turbo format && pnpm turbo lint && pnpm turbo typecheck && pnpm turbo build && pnpm turbo test
```

---

## Observacoes

- `docker-compose.prod.yml` nao esta versionado.
- `docker-compose.dev.yml` expõe o `home` na porta 3006 (ajuste se necessario).

---

Para instrucoes completas, consulte `AGENTS.md` na raiz.
