# 🤖 AGENTS.md — Portal Essência Feliz

> **Instruções de Execução para Agentes de IA**
>
> Este documento transforma você em um **programador sênior** do projeto. Siga estas instruções para gerar código consistente, seguro e alinhado com a arquitetura estabelecida.

---

## 📋 Índice

1. [Regra de Ouro](#-regra-de-ouro)
2. [Loop Obrigatório de Execução](#-loop-obrigatório-de-execução)
3. [Contexto Rápido](#-contexto-rápido)
4. [Fontes de Verdade](#-fontes-de-verdade)
5. [Guardrails Inegociáveis](#-guardrails-inegociáveis)
6. [Contratos de API](#-contratos-de-api)
7. [Definition of Done](#-definition-of-done)
8. [Anti-Patterns](#-anti-patterns)
9. [Roteador de Tarefas](#-roteador-de-tarefas)
10. [Playbooks de Execução](#-playbooks-de-execução)
11. [Quick Reference](#-quick-reference)
12. [Formato de Entrega](#-formato-de-entrega)
13. [Troubleshooting](#-troubleshooting)
14. [Observabilidade](#-observabilidade)
15. [CI/CD](#-cicd)
16. [Documentação Obrigatória](#-documentação-obrigatória-links)

---

## 🎯 Regra de Ouro

```
╔══════════════════════════════════════════════════════════════════╗
║  NÃO INVENTE. NÃO ADIVINHE.                                      ║
║  Sempre busque evidência no código, configs e docs canonizados.  ║
╚══════════════════════════════════════════════════════════════════╝
```

**Antes de qualquer implementação:**

1. Localize um **exemplo canônico** no repositório (endpoint similar, componente similar, schema similar)
2. **Copie o padrão existente** antes de criar algo novo
3. Se houver conflito entre docs → aplique o [Protocolo de Drift](#protocolo-de-drift)
4. Se a decisão for de produto (UX/regra de negócio) → proponha opções e peça decisão

---

## 🔄 Loop Obrigatório de Execução

```
╔═══════════════════════════════════════════════════════════════════╗
║  TODO AGENTE DEVE SEGUIR ESTE LOOP EM CADA TAREFA                 ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Fase 1: DESCOBERTA (antes de escrever código)

**Objetivo:** Encontrar exemplos canônicos e entender o contexto existente.

```bash
# Buscar padrões existentes no backend
rg "TenantGuard" services/api/src -n
rg "@Roles" services/api/src -n
rg "AuthGuard" services/api/src -n

# Buscar padrões existentes no frontend
rg "clientFetch" packages/shared -n
rg "serverFetch" packages/shared -n
rg "useForm" apps/ -n

# Buscar schemas e tipos existentes
rg "z\.object" packages/shared -n
rg "interface.*Props" apps/ -n

# Verificar estrutura de módulos
ls -la services/api/src/modules/
ls -la apps/<modulo>/app/

# Buscar endpoints similares
rg "Controller" services/api/src/modules/<dominio> -n
rg "route.ts" apps/<modulo>/app/api -n
```

**Checklist de Descoberta:**

- [ ] Encontrei endpoint/componente similar no repo?
- [ ] Identifiquei o padrão de guards usado?
- [ ] Verifiquei tipos existentes em `packages/shared`?
- [ ] Confirmei estrutura de pastas do módulo alvo?

---

### Fase 2: PLANO (antes de implementar)

**Objetivo:** Definir passos claros, riscos e estratégia de rollback.

**Template de Plano:**

```markdown
### Plano de Implementação

**Escopo:** [descrição curta]

**Passos:**

1. [Passo específico com arquivo]
2. [Passo específico com arquivo]
   ...

**Arquivos a criar/modificar:**

- `path/to/file.ts` — [motivo]

**Riscos identificados:**

- [Risco 1] → [Mitigação]

**Rollback:**

- [Como reverter se falhar]

**Dependências:**

- [Precisa de algo pronto antes?]
```

---

### Fase 3: IMPLEMENTAÇÃO

**Objetivo:** Executar o plano seguindo padrões canônicos.

**Regras:**

1. **Copiar padrão existente** antes de criar algo novo
2. **Um arquivo por vez** — validar antes de prosseguir
3. **Seguir convenções** do módulo/pasta onde está trabalhando
4. **Não adicionar dependências** sem justificativa (ver [Política de Dependências](#política-de-dependências))

---

### Fase 4: VALIDAÇÃO LOCAL

**Objetivo:** Garantir que tudo funciona antes de entregar.

```bash
# Ciclo completo de qualidade (executar SEMPRE)
pnpm turbo format          # Formatar código
pnpm turbo lint            # Verificar linting
pnpm turbo typecheck       # Verificar tipos
pnpm turbo test            # Executar testes
pnpm turbo build           # Build de produção

# Validação específica por módulo
pnpm --filter @essencia/api test
pnpm --filter planejamento test
pnpm --filter @essencia/db test

# Verificar se migrations estão ok
pnpm turbo db:generate     # Se alterou schema
pnpm turbo db:migrate      # Aplicar migrations
```

**⛔ NÃO prosseguir se qualquer comando falhar.**

---

### Fase 5: ENTREGA

**Objetivo:** Entregar no formato padrão com docs e testes.

**Checklist Final:**

- [ ] Template de entrega preenchido completamente
- [ ] Testes adicionados e listados
- [ ] Documentação atualizada (API.md, CHANGELOG.md, etc.)
- [ ] Commit message no padrão Conventional Commits
- [ ] Nenhum guardrail violado

---

## 🏗 Contexto Rápido

### Stack Tecnológica

> ⚠️ **Versões reais estão no `package.json` de cada workspace.** Este doc pode ficar desatualizado — sempre verifique.

| Camada       | Tecnologia                  | Verificar versão em         |
| ------------ | --------------------------- | --------------------------- |
| **Monorepo** | Turborepo + pnpm workspaces | `package.json` (raiz)       |
| **Frontend** | Next.js (App Router)        | `apps/*/package.json`       |
| **Backend**  | NestJS + Fastify            | `services/api/package.json` |
| **Database** | PostgreSQL + Drizzle ORM    | `packages/db/package.json`  |
| **Sessions** | Redis                       | `services/api/package.json` |
| **UI**       | Tailwind CSS + shadcn/ui    | `packages/ui/package.json`  |
| **Deploy**   | Traefik                     | `docker-compose.prod.yml`   |

```bash
# Verificar versões reais
cat package.json | jq '.devDependencies.turbo'
cat apps/planejamento/package.json | jq '.dependencies.next'
cat services/api/package.json | jq '.dependencies["@nestjs/core"]'
```

### Estrutura de Diretórios (com nomes reais de workspaces)

```
portalessencia/
├── apps/                           # Next.js apps (módulos isolados)
│   ├── home/             :3000     # @essencia/home
│   ├── login/            :3003     # @essencia/login
│   ├── usuarios/         :3004     # @essencia/usuarios
│   ├── escolas/          :3005     # @essencia/escolas
│   ├── turmas/           :3006     # @essencia/turmas
│   └── planejamento/     :3007     # @essencia/planejamento
├── services/
│   └── api/              :3001     # @essencia/api
├── packages/
│   ├── ui/                         # @essencia/ui
│   ├── db/                         # @essencia/db
│   ├── shared/                     # @essencia/shared
│   ├── components/                 # @essencia/components
│   ├── config/                     # @essencia/config
│   └── tailwind-config/            # @essencia/tailwind-config
├── e2e/                            # Testes E2E (Playwright)
└── scripts/                        # Deploy e manutenção
```

### Princípios Arquiteturais

| Princípio                  | Descrição                                              |
| -------------------------- | ------------------------------------------------------ |
| **Governança de Dados**    | Apps NUNCA acessam DB diretamente                      |
| **Type-safety End-to-End** | Contratos e tipos compartilhados via `packages/shared` |
| **Multi-tenant**           | Escola → Unidade → Usuários                            |
| **RBAC**                   | Roles hierárquicos + Guards                            |

---

## 📚 Fontes de Verdade

Quando houver divergência, a prioridade é:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. CÓDIGO E CONFIGS (package.json, turbo.json)                 │
│  2. ARCHITECTURE.md + DEPLOYMENT.md                             │
│  3. SECURITY.md + DATABASE.md                                   │
│  4. README.md + docs de módulo                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Protocolo de Drift

Se detectar divergência entre documentação e código:

1. **Identificar**: "Doc A diz X, Doc B diz Y"
2. **Verificar no código**: scripts, env, configs
3. **Declarar verdade operacional** (baseada no código)
4. **Propor patch** na seção "Doc Drift" da entrega

---

## 🛡 Guardrails Inegociáveis

### 1. Governança de Dados

```
╔═══════════════════════════════════════════════════════════════════╗
║  ⛔ PROIBIDO: apps/** importar packages/db ou acessar Drizzle    ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Fluxo correto:**

```
App (Next.js) → Proxy HTTP (Route Handler) → API (NestJS) → DB (Drizzle)
```

**Se detectar violação:**

1. Parar implementação
2. Remover import proibido
3. Substituir por chamada à API + tipos em `packages/shared`
4. Registrar em "Guardrails aplicados"

### 2. Autenticação & Sessão

| Regra                                          | Motivo                   |
| ---------------------------------------------- | ------------------------ |
| Nunca bypassar auth no frontend                | Segurança                |
| Nunca logar cookies/tokens/sessões em texto    | Vazamento de credenciais |
| Usar hash truncado em logs (quando necessário) | Auditoria segura         |

**Configuração de Cookie por Ambiente:**

| Atributo   | Desenvolvimento (LOCAL) | Produção (PROD)    |
| ---------- | ----------------------- | ------------------ |
| `Name`     | `cef_session`           | `cef_session`      |
| `HttpOnly` | `true`                  | `true`             |
| `Secure`   | `false`                 | `true`             |
| `SameSite` | `Lax`                   | `Lax`              |
| `Domain`   | `localhost`             | `.essencia.edu.br` |
| `Path`     | `/`                     | `/`                |
| `Max-Age`  | `86400` (24h)           | `86400` (24h)      |

**Verificar implementação:**

```bash
rg "cef_session" services/api/src -n
rg "cookie" services/api/src/auth -n
cat services/api/src/auth/session.config.ts
```

**CORS — Configuração por Ambiente:**

```typescript
// services/api/src/main.ts
// DEV: permite localhost de todos os apps
const corsOrigins = {
  development: [
    "http://localhost:3000", // home
    "http://localhost:3003", // login
    "http://localhost:3004", // usuarios
    "http://localhost:3005", // escolas
    "http://localhost:3006", // turmas
    "http://localhost:3007", // planejamento
  ],
  production: ["https://essencia.edu.br", "https://*.essencia.edu.br"],
};
```

**Verificar CORS:**

```bash
rg "cors" services/api/src/main.ts -n
rg "origin" services/api/src/main.ts -n
```

**CSRF — Proteção:**

| Endpoint             | Método          | Proteção CSRF                             |
| -------------------- | --------------- | ----------------------------------------- |
| `/auth/login`        | POST            | Rate limiting (5 req/min/IP)              |
| `/auth/logout`       | POST            | Requer sessão válida                      |
| Endpoints de mutação | POST/PUT/DELETE | `SameSite: Lax` + verificação de `Origin` |
| Endpoints sensíveis  | \*              | Double-submit cookie (se necessário)      |

> **Nota:** Com `SameSite: Lax`, requests cross-origin não enviam cookie automaticamente em POST/PUT/DELETE. Para endpoints muito sensíveis (ex: transferência de dados, delete em massa), considerar double-submit cookie.

### 3. RBAC + Multi-Tenant

**Cadeia de Guards obrigatória:**

```
Request → AuthGuard → RolesGuard → TenantGuard → Controller
```

**Hierarquia de Roles:**

| Role                       | Nível | Escopo  |
| -------------------------- | ----- | ------- |
| `master`                   | 0     | Global  |
| `diretora_geral`           | 1     | Escola  |
| `gerente_unidade`          | 2     | Unidade |
| `gerente_financeiro`       | 3     | Unidade |
| `coordenadora_geral`       | 4     | Unidade |
| `coordenadora_bercario`    | 5     | Unidade |
| `coordenadora_infantil`    | 6     | Unidade |
| `coordenadora_fundamental_i` | 7   | Unidade |
| `coordenadora_fundamental_ii` | 8  | Unidade |
| `coordenadora_medio`       | 9     | Unidade |
| `analista_pedagogico`      | 10    | Unidade |
| `professora`               | 11    | Unidade |
| `auxiliar_administrativo`  | 12    | Unidade |
| `auxiliar_sala`            | 13    | Unidade |

**Regras de Isolamento:**

- `master`: acesso global (todas as escolas)
- `diretora_geral`: acesso a toda a escola (todas as unidades)
- Roles de etapa: apenas sua unidade + etapa
- Demais roles: apenas sua unidade

⛔ **Acesso cross-tenant**: recusar tecnicamente e propor alternativa segura.

---

#### 🔒 REGRAS DE TENANT NÃO NEGOCIÁVEIS

```
╔═══════════════════════════════════════════════════════════════════╗
║  SOURCE OF TRUTH: A identidade do tenant vem SEMPRE da SESSÃO    ║
║  session.userId | session.schoolId | session.unitId | session.stageId | session.role║
╚═══════════════════════════════════════════════════════════════════╝
```

**Regra 1: Sessão é a única fonte de identidade**

```typescript
// ✅ CORRETO: Usar dados da sessão
const { schoolId, unitId, stageId, role } = req.session;
await this.service.findByUnit(unitId);

// ⛔ ERRADO: Confiar no payload do cliente
const { unitId } = req.body; // NUNCA usar isso como identidade!
```

**Regra 2: Payload pode sugerir filtros, nunca define identidade**

```typescript
// ✅ CORRETO: Payload filtra DENTRO do escopo permitido
// Se role=professora, só pode ver seus próprios planejamentos
const plans = await this.service.find({
  userId: session.userId, // identidade da sessão
  turmaId: req.body.turmaId, // filtro do payload (ok)
});

// ⛔ ERRADO: Payload define acesso
const plans = await this.service.find({
  unitId: req.body.unitId, // cliente escolhendo tenant = VULNERABILIDADE
});
```

**Regra 3: Validação de acesso cross-tenant**

```typescript
// Se payload pede recurso de outra unidade e role não permite → 403
if (resource.unitId !== session.unitId && !canAccessAllUnits(session.role)) {
  throw new ForbiddenException("Acesso negado: recurso de outra unidade");
}

if (resource.stageId !== session.stageId && !canAccessAllStages(session.role)) {
  throw new ForbiddenException("Acesso negado: recurso de outra etapa");
}
```

**Matriz de Permissão por Role:**

| Role             | Pode acessar outras unidades? | Pode acessar outras escolas? |
| ---------------- | ----------------------------- | ---------------------------- |
| `master`         | ✅ Sim                        | ✅ Sim                       |
| `diretora_geral` | ✅ Sim (mesma escola)         | ❌ Não                       |
| Demais roles     | ❌ Não                        | ❌ Não                       |

---

### 4. Segurança de Inputs

| Camada   | Validação                     |
| -------- | ----------------------------- |
| Frontend | Zod schemas                   |
| Backend  | DTO + class-validator         |
| Database | Prepared statements (Drizzle) |

⛔ **Nunca interpolar SQL manualmente.**

### 5. Mudanças Destrutivas

- Sem `DROP` ou deleções irreversíveis sem plano de migração
- Toda migração deve ser reversível ou ter estratégia de mitigação

### 6. Documentação Obrigatória

```
╔═══════════════════════════════════════════════════════════════════╗
║  📝 TODA implementação DEVE atualizar a documentação em docs/     ║
╚═══════════════════════════════════════════════════════════════════╝
```

| Mudança                       | Documento a Atualizar         |
| ----------------------------- | ----------------------------- |
| Novo endpoint / alteração API | `docs/API.md`                 |
| Alteração de schema           | `docs/DATABASE.md`            |
| Mudança em auth/RBAC/sessão   | `docs/SECURITY.md`            |
| Nova feature / bug fix        | `docs/CHANGELOG.md`           |
| Mudança em deploy/infra       | `docs/DEPLOYMENT.md`          |
| Novo módulo                   | `docs/ARCHITECTURE.md`        |
| Módulo de planejamento        | `docs/MODULO_PLANEJAMENTO.md` |

**Regra:** Se a implementação não vier acompanhada de atualização de docs, está **incompleta**.

### 7. Testes Obrigatórios

```
╔═══════════════════════════════════════════════════════════════════╗
║  🧪 IMPLEMENTAÇÃO SEM TESTES = IMPLEMENTAÇÃO RECUSADA             ║
║     Testes são OBRIGATÓRIOS, não opcionais.                       ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Classificação por Tamanho de Implementação:**

| Tamanho     | Critério                                 | Testes Exigidos        |
| ----------- | ---------------------------------------- | ---------------------- |
| **Pequeno** | Bug fix, ajuste pontual                  | Teste de regressão     |
| **Médio**   | Novo endpoint, novo componente           | Suite de testes básica |
| **Grande**  | Nova feature, novo módulo, CRUD completo | Suite completa + E2E   |

---

#### 🔴 GRANDES IMPLEMENTAÇÕES (Feature/Módulo Novo)

**Para implementações grandes, o agente DEVE:**

1. **Criar suite de testes ANTES ou JUNTO** com o código
2. **Cobrir TODOS os cenários críticos** listados abaixo
3. **Executar testes completos** antes de finalizar
4. **Documentar cobertura** na entrega

**Checklist de Testes para Backend (NestJS/Jest):**

```
┌─────────────────────────────────────────────────────────────────┐
│  ⛔ OBRIGATÓRIO PARA CADA ENDPOINT                              │
├─────────────────────────────────────────────────────────────────┤
│  □ 401 Unauthorized - sem sessão                                │
│  □ 403 Forbidden - role sem permissão                           │
│  □ 403 Forbidden - tenant diferente (isolamento)                │
│  □ 400 Bad Request - payload inválido                           │
│  □ 404 Not Found - recurso inexistente                          │
│  □ 200/201 Success - caso válido                                │
│  □ Edge cases - null, empty, limites, duplicatas                │
└─────────────────────────────────────────────────────────────────┘
```

**Exemplo de Suite Completa (Backend):**

```typescript
describe("PlanningsController", () => {
  describe("POST /plannings/submit", () => {
    it("should return 401 when not authenticated", async () => {
      const response = await request(app)
        .post("/plannings/submit")
        .send(validPayload);
      expect(response.status).toBe(401);
    });

    it("should return 403 when role is not allowed", async () => {
      const response = await request(app)
        .post("/plannings/submit")
        .set("Cookie", auxiliarSession)
        .send(validPayload);
      expect(response.status).toBe(403);
    });

    it("should return 403 when accessing different tenant", async () => {
      const response = await request(app)
        .post("/plannings/submit")
        .set("Cookie", professoraUnitASession)
        .send({ ...validPayload, unitId: unitBId });
      expect(response.status).toBe(403);
    });

    it("should return 400 when payload is invalid", async () => {
      const response = await request(app)
        .post("/plannings/submit")
        .set("Cookie", professoraSession)
        .send({});
      expect(response.status).toBe(400);
    });

    it("should return 201 and create planning when valid", async () => {
      const response = await request(app)
        .post("/plannings/submit")
        .set("Cookie", professoraSession)
        .send(validPayload);
      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();
    });
  });
});
```

**Checklist de Testes para Frontend (Vitest):**

```
┌─────────────────────────────────────────────────────────────────┐
│  ⛔ OBRIGATÓRIO PARA CADA COMPONENTE/FEATURE                    │
├─────────────────────────────────────────────────────────────────┤
│  □ Renderização inicial correta                                 │
│  □ Estado de loading exibido                                    │
│  □ Estado de empty exibido                                      │
│  □ Estado de error exibido                                      │
│  □ Interações do usuário (clicks, inputs, submits)              │
│  □ Validação de formulários                                     │
│  □ Navegação entre etapas (wizards)                             │
│  □ Integração com API (mocked)                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Exemplo de Suite Completa (Frontend):**

```typescript
describe('PlanningWizard', () => {
  it('should render step 1 by default', () => {
    render(<PlanningWizard />);
    expect(screen.getByText('Dados da Turma')).toBeInTheDocument();
  });

  it('should show validation errors on empty submit', async () => {
    render(<PlanningWizard />);
    await userEvent.click(screen.getByText('Próximo'));
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });

  it('should navigate to step 2 after valid step 1', async () => {
    render(<PlanningWizard />);
    await userEvent.selectOptions(screen.getByLabelText('Turma'), 'Infantil 3A');
    await userEvent.click(screen.getByText('Próximo'));
    expect(screen.getByText('Objetivos')).toBeInTheDocument();
  });

  it('should show loading state on submit', async () => {
    server.use(http.post('/api/plannings/submit', () => delay(1000)));
    render(<PlanningWizard />);
    // ... preencher formulário
    await userEvent.click(screen.getByText('Enviar'));
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should show error toast on API failure', async () => {
    server.use(http.post('/api/plannings/submit', () => HttpResponse.error()));
    render(<PlanningWizard />);
    // ... preencher formulário
    await userEvent.click(screen.getByText('Enviar'));
    expect(screen.getByText('Erro ao enviar')).toBeInTheDocument();
  });
});
```

---

**Comandos de Teste:**

```bash
# Executar todos os testes
pnpm turbo test

# Testes com cobertura
pnpm turbo test --coverage

# Testes de um módulo específico
pnpm turbo --filter @essencia/api test
pnpm turbo --filter planejamento test

# Watch mode durante desenvolvimento
pnpm turbo test --watch
```

---

**⛔ REGRA FINAL: O agente DEVE:**

1. Escrever testes ANTES ou JUNTO com a implementação (TDD recomendado)
2. Garantir que `pnpm turbo test` passa 100% no escopo afetado
3. Listar na entrega todos os testes adicionados
4. Se a implementação for grande e não tiver testes → **PARAR e adicionar testes**

### 8. Qualidade de Código Obrigatória

```
╔═══════════════════════════════════════════════════════════════════╗
║  ✅ ANTES de finalizar, SEMPRE executar o ciclo de qualidade     ║
╚═══════════════════════════════════════════════════════════════════╝
```

```bash
# Ciclo completo de qualidade
pnpm turbo format && pnpm turbo lint && pnpm turbo typecheck && pnpm turbo build && pnpm turbo test
```

> **Dica:** Se algum comando falhar, corrija antes de prosseguir. Não faça commit com erros de lint ou type.

### 9. Testes E2E (End-to-End)

```
╔═══════════════════════════════════════════════════════════════════╗
║  🎭 E2E = Playwright | Fluxos críticos de usuário real           ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Ferramenta:** Playwright

**Quando E2E é obrigatório:**

| Tipo de Implementação | E2E Requerido?                     |
| --------------------- | ---------------------------------- |
| Novo módulo/app       | ✅ Sim — fluxo completo            |
| Nova feature crítica  | ✅ Sim — happy path + erros        |
| Mudança em auth/login | ✅ Sim — login + proteção de rotas |
| Bug fix em fluxo      | ✅ Sim — teste que reproduz o bug  |
| Ajuste de UI simples  | ❌ Não                             |

**Escopo mínimo por módulo:**

```typescript
// e2e/planejamento.spec.ts
describe("Planejamento E2E", () => {
  test("fluxo completo: login → criar → submeter → aprovar", async ({
    page,
  }) => {
    // 1. Login como professora
    await page.goto("/login");
    await page.fill("[name=email]", "professora@escola.com");
    await page.fill("[name=password]", "senha123");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL("/planejamento");

    // 2. Criar planejamento
    await page.click("text=Novo Planejamento");
    // ... preencher wizard

    // 3. Submeter
    await page.click("text=Enviar para Coordenação");
    await expect(page.locator(".toast-success")).toBeVisible();
  });

  test("deve bloquear acesso sem autenticação", async ({ page }) => {
    await page.goto("/planejamento");
    await expect(page).toHaveURL("/login");
  });

  test("deve mostrar 403 para role sem permissão", async ({ page }) => {
    // Login como auxiliar_sala
    // Tentar acessar dashboard de coordenação
    await expect(page.locator("text=Acesso negado")).toBeVisible();
  });
});
```

**Comandos:**

```bash
# Executar E2E
pnpm e2e

# E2E com UI (debug)
pnpm e2e --ui

# E2E de módulo específico
pnpm e2e --grep "Planejamento"

# Gerar relatório
pnpm e2e --reporter=html
```

### 10. Política de Dependências

```
╔═══════════════════════════════════════════════════════════════════╗
║  📦 NÃO adicionar lib nova sem justificar e verificar existente  ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Antes de instalar uma nova dependência:**

1. **Verificar se já existe equivalente no repo:**

```bash
# Buscar utilitários existentes
rg "export function" packages/shared/src -n
rg "export const" packages/shared/src -n

# Verificar package.json dos pacotes
cat packages/shared/package.json | jq '.dependencies'
cat packages/ui/package.json | jq '.dependencies'
```

2. **Preferência de uso:**

| Precisa de...  | Usar primeiro                   | Só depois considerar |
| -------------- | ------------------------------- | -------------------- |
| Utilitários    | `packages/shared`               | lodash, ramda        |
| Componentes UI | `@essencia/ui` (shadcn)         | Material UI, Chakra  |
| Validação      | Zod (já instalado)              | Yup, Joi             |
| Formulários    | react-hook-form (já instalado)  | Formik               |
| Fetch/HTTP     | fetch nativo + fetchers do repo | axios                |
| Data/hora      | date-fns (já instalado)         | moment, dayjs        |
| Estado global  | React Context + hooks           | Redux, Zustand       |

3. **Se realmente precisar de lib nova:**

```markdown
## Justificativa de Nova Dependência

**Lib:** [nome]
**Versão:** [x.y.z]
**Motivo:** [por que não dá pra usar o que já existe]
**Alternativas consideradas:** [o que foi avaliado]
**Impacto no bundle:** [tamanho aproximado]
**Onde será usada:** [escopo — um app ou monorepo inteiro]
```

⛔ **Libs proibidas (já temos equivalente):**

- `axios` → usar fetch nativo
- `moment` → usar date-fns
- `lodash` completo → usar funções específicas ou implementar em shared
- `styled-components` → usar Tailwind

---

## 📜 Contratos de API

### Envelope de Resposta Padrão

```
╔═══════════════════════════════════════════════════════════════════╗
║  TODO endpoint DEVE usar este envelope — sem exceções             ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Sucesso (2xx):**

```typescript
// services/api/src/common/interfaces/response.interface.ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    timestamp?: string;
    correlationId?: string;
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

**Erro (4xx/5xx):**

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
    field?: string; // Para erros de validação
  };
  meta?: {
    timestamp?: string;
    correlationId?: string;
  };
}
```

### Error Codes (Enum Obrigatório)

```typescript
// services/api/src/common/enums/error-codes.enum.ts
enum ErrorCode {
  // Auth (401)
  UNAUTHORIZED = "UNAUTHORIZED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

  // Forbidden (403)
  FORBIDDEN = "FORBIDDEN",
  ROLE_NOT_ALLOWED = "ROLE_NOT_ALLOWED",
  TENANT_MISMATCH = "TENANT_MISMATCH",

  // Validation (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  // Not Found (404)
  NOT_FOUND = "NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",

  // Conflict (409)
  CONFLICT = "CONFLICT",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",

  // Server (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
}
```

**Verificar implementação:**

```bash
rg "ErrorCode" services/api/src -n
cat services/api/src/common/enums/error-codes.enum.ts
```

### Padrão de Paginação

**Request (Query Params):**

```typescript
// GET /users?page=1&limit=20&sort=name&order=asc&filter[role]=professora
interface PaginationQuery {
  page?: number; // default: 1
  limit?: number; // default: 20, max: 100
  sort?: string; // campo para ordenar
  order?: "asc" | "desc"; // default: 'asc'
  filter?: Record<string, string>; // filtros dinâmicos
}
```

**Response:**

```typescript
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Padrão de Filtros

| Tipo de Filtro | Sintaxe Query Param   | Exemplo                            |
| -------------- | --------------------- | ---------------------------------- |
| Igualdade      | `filter[field]=value` | `filter[role]=professora`          |
| Busca texto    | `search=termo`        | `search=maria`                     |
| Range de data  | `startDate=&endDate=` | `startDate=2025-01-01`             |
| Múltiplos      | `filter[field]=a,b,c` | `filter[status]=PENDENTE,APROVADO` |

---

## ✅ Definition of Done

### Por Tipo de Tarefa

#### 🐛 Bug Fix

```
┌─────────────────────────────────────────────────────────────────┐
│  Definition of Done: BUG FIX                                    │
├─────────────────────────────────────────────────────────────────┤
│  □ Causa raiz identificada e documentada                        │
│  □ Teste que reproduz o bug (falha antes, passa depois)         │
│  □ Fix implementado                                             │
│  □ Sem regressões (pnpm test passa)                             │
│  □ CHANGELOG.md atualizado                                      │
│  □ Commit: fix(escopo): descrição                               │
└─────────────────────────────────────────────────────────────────┘
```

#### 🔌 Novo Endpoint

```
┌─────────────────────────────────────────────────────────────────┐
│  Definition of Done: NOVO ENDPOINT                              │
├─────────────────────────────────────────────────────────────────┤
│  □ Rota definida com guards (Auth + Roles + Tenant)             │
│  □ DTO com validação (class-validator)                          │
│  □ Service com lógica de negócio                                │
│  □ Filtro por tenant (schoolId/unitId)                          │
│  □ Resposta no envelope padrão                                  │
│  □ Error codes corretos                                         │
│  □ Testes: 401, 403 (role), 403 (tenant), 400, 404, 200/201     │
│  □ API.md atualizado                                            │
│  □ CHANGELOG.md atualizado                                      │
│  □ Commit: feat(modulo): descrição                              │
└─────────────────────────────────────────────────────────────────┘
```

#### 🖼️ Nova Tela/Componente

```
┌─────────────────────────────────────────────────────────────────┐
│  Definition of Done: NOVA TELA/COMPONENTE                       │
├─────────────────────────────────────────────────────────────────┤
│  □ Componente com tipos (Props interface)                       │
│  □ Estados: loading, empty, error, success                      │
│  □ Integração com API via fetchers do repo                      │
│  □ Validação de formulário (Zod + react-hook-form)              │
│  □ Tratamento de 401 (redirect /login)                          │
│  □ Testes: renderização, interações, estados                    │
│  □ Responsivo (mobile-first)                                    │
│  □ Acessibilidade básica (labels, aria)                         │
│  □ CHANGELOG.md atualizado                                      │
│  □ Commit: feat(modulo): descrição                              │
└─────────────────────────────────────────────────────────────────┘
```

#### 📦 Novo Módulo/Feature Grande

```
┌─────────────────────────────────────────────────────────────────┐
│  Definition of Done: MÓDULO NOVO                                │
├─────────────────────────────────────────────────────────────────┤
│  □ Todos os DoD de endpoints aplicados                          │
│  □ Todos os DoD de telas aplicados                              │
│  □ Schema de banco com migration                                │
│  □ Tipos compartilhados em packages/shared                      │
│  □ Testes E2E do fluxo completo                                 │
│  □ API.md atualizado (todos endpoints)                          │
│  □ DATABASE.md atualizado (se schema novo)                      │
│  □ ARCHITECTURE.md atualizado                                   │
│  □ CHANGELOG.md atualizado                                      │
│  □ README.md atualizado (se necessário)                         │
│  □ Commit: feat(modulo): descrição                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚫 Anti-Patterns

```
╔═══════════════════════════════════════════════════════════════════╗
║  CÓDIGO QUE VIOLA ESTES PADRÕES SERÁ REJEITADO                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### 1. Tenant vindo do Body/Query (CRÍTICO)

```typescript
// ⛔ ERRADO: Cliente define tenant
async findAll(@Body() body: { unitId: string }) {
  return this.service.findByUnit(body.unitId);
}

// ✅ CORRETO: Sessão define tenant
async findAll(@Session() session: SessionData) {
  return this.service.findByUnit(session.unitId);
}
```

### 2. Import direto de packages/db em apps

```typescript
// ⛔ ERRADO: apps/planejamento/...
import { db } from "@essencia/db";
const users = await db.select().from(users);

// ✅ CORRETO: apps/planejamento/...
import { getUsers } from "@/lib/api";
const users = await getUsers();
```

### 3. Log de dados sensíveis

```typescript
// ⛔ ERRADO
console.log("Session:", req.session);
console.log("Cookie:", req.cookies);
console.log("User:", { ...user, password: user.password });

// ✅ CORRETO
console.log("Session ID:", hashTruncated(req.sessionId));
console.log("User:", { id: user.id, role: user.role });
```

### 4. SQL interpolado

```typescript
// ⛔ ERRADO
const result = await db.execute(`SELECT * FROM users WHERE id = '${userId}'`);

// ✅ CORRETO (Drizzle)
const result = await db.select().from(users).where(eq(users.id, userId));
```

### 5. Bypass de Guards

```typescript
// ⛔ ERRADO: Endpoint sem proteção
@Get('users')
async findAll() { ... }

// ✅ CORRETO: Cadeia completa de guards
@Get('users')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@Roles('gerente_unidade', 'diretora_geral', 'master')
async findAll() { ... }
```

### 6. Resposta fora do envelope

```typescript
// ⛔ ERRADO
return users;
return { users, total: 100 };

// ✅ CORRETO
return { success: true, data: users, meta: { pagination: {...} } };
```

### 7. Erro genérico sem código

```typescript
// ⛔ ERRADO
throw new BadRequestException("Erro");

// ✅ CORRETO
throw new BadRequestException({
  code: ErrorCode.VALIDATION_ERROR,
  message: "Campo turma é obrigatório",
  field: "turma",
});
```

### 8. Dependência não justificada

```typescript
// ⛔ ERRADO: Adicionar lodash só pra usar _.isEmpty
import _ from 'lodash';
if (_.isEmpty(arr)) { ... }

// ✅ CORRETO: Usar JS nativo ou utilitário do repo
if (!arr || arr.length === 0) { ... }
// ou
import { isEmpty } from '@essencia/shared/utils';
```

---

## 🎮 Roteador de Tarefas

### Classificação de Pedidos

| Código   | Tipo                         | Prioridade |
| -------- | ---------------------------- | ---------- |
| `SEC`    | Segurança/permissão          | 1          |
| `DB-CHG` | Alteração de schema/migração | 2          |
| `BE-NEW` | Feature nova (backend/API)   | 3          |
| `FE-NEW` | Feature nova (frontend)      | 4          |
| `BUG`    | Correção de bug              | 5          |
| `DOCS`   | Documentação                 | 6          |
| `OPS`    | Deploy/infra/observabilidade | 7          |

**Ordem de execução quando múltiplas categorias:**

```
SEC → DB-CHG → BE-NEW → FE-NEW → BUG → DOCS → OPS
```

---

## 📖 Playbooks de Execução

### FE-NEW — Feature Nova no Frontend

**Objetivo:** Implementar UI + integração seguindo padrões do repo.

```
┌─────────────────────────────────────────────────────────────────┐
│  CHECKLIST FE-NEW                                               │
├─────────────────────────────────────────────────────────────────┤
│  □ Localizar app correto em apps/<modulo>                       │
│  □ Identificar padrão de proxy (app/api/[...path]/route.ts)     │
│  □ Definir contrato em packages/shared (tipos + Zod)            │
│  □ Implementar UI com @essencia/ui                              │
│  □ Estados: loading / empty / error                             │
│  □ Auth: 401 → limpar cache → redirect /login                   │
│  □ Testes Vitest para fluxos críticos                           │
│  □ pnpm lint && pnpm typecheck && pnpm test                     │
└─────────────────────────────────────────────────────────────────┘
```

**Padrão de Fetcher (Client):**

```typescript
// packages/shared/src/fetchers/client.ts
export async function clientFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (res.status === 401) {
    // limpar cache, redirect /login
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

### BE-NEW — Feature Nova na API

**Objetivo:** Endpoint seguro, multi-tenant e com contratos claros.

```
┌─────────────────────────────────────────────────────────────────┐
│  CHECKLIST BE-NEW                                               │
├─────────────────────────────────────────────────────────────────┤
│  □ Confirmar módulo: services/api/src/modules/<dominio>         │
│  □ Definir rota, DTO e roles permitidas                         │
│  □ Implementar Service + integração com @essencia/db            │
│  □ Filtrar por schoolId/unitId conforme role                    │
│  □ AuthGuard → RolesGuard → TenantGuard                         │
│  □ Respostas padronizadas (200/201/400/401/403/404)             │
│  □ Testes Jest: 401/403/200                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Estrutura de Response:**

```typescript
// Sucesso
{ "success": true, "data": { ... } }

// Erro
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }
```

---

### DB-CHG — Mudança de Schema

**Objetivo:** Migração segura e reversível.

```
┌─────────────────────────────────────────────────────────────────┐
│  CHECKLIST DB-CHG                                               │
├─────────────────────────────────────────────────────────────────┤
│  □ Ajustar schema em packages/db/src/schema/**                  │
│  □ pnpm db:generate                                             │
│  □ Validar migração: pnpm db:migrate                            │
│  □ Se dados existentes: backfill, defaults, nullable → not null │
│  □ Plano de rollback documentado                                │
└─────────────────────────────────────────────────────────────────┘
```

---

### BUG — Correção de Bug

```
┌─────────────────────────────────────────────────────────────────┐
│  CHECKLIST BUG                                                  │
├─────────────────────────────────────────────────────────────────┤
│  □ Reproduzir (ou inferir) via logs/trace/steps                 │
│  □ Encontrar causa raiz                                         │
│  □ Escrever teste que falha → aplicar fix → teste passa         │
│  □ Verificar efeitos colaterais (RBAC, tenant, cache)           │
└─────────────────────────────────────────────────────────────────┘
```

---

### SEC — Segurança

```
┌─────────────────────────────────────────────────────────────────┐
│  CHECKLIST SEC                                                  │
├─────────────────────────────────────────────────────────────────┤
│  □ Identificar superfície (endpoint, tela, fluxo)               │
│  □ Garantir validação e menor privilégio                        │
│  □ Revisar logs (sem dados sensíveis)                           │
│  □ Validar 401/403 corretos                                     │
│  □ Sem vazamento de PII/tenant                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### OPS — Deploy/Infra

```
┌─────────────────────────────────────────────────────────────────┐
│  CHECKLIST OPS                                                  │
├─────────────────────────────────────────────────────────────────┤
│  □ Validar configurações e labels Traefik                       │
│  □ Garantir health checks                                       │
│  □ Definir rollback                                             │
│  □ Atualizar DEPLOYMENT.md                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Reference

### Comandos Essenciais (via Turborepo)

```
╔═══════════════════════════════════════════════════════════════════╗
║  FONTE OFICIAL: Scripts definidos no package.json raiz            ║
║  Turborepo gerencia cache e dependências entre workspaces         ║
╚═══════════════════════════════════════════════════════════════════╝
```

```bash
# Setup inicial
pnpm turbo install                          # Instala todas as dependências
pnpm turbo db:migrate                       # Aplica migrations

# Development
pnpm dev                              # Todos os apps em paralelo (Turborepo)
pnpm turbo --filter @essencia/api dev       # Apenas API
pnpm turbo --filter @essencia/planejamento dev  # Apenas Planejamento

# Quality (via Turborepo - com cache)
pnpm turbo lint                             # ESLint em todos os workspaces
pnpm turbo typecheck                        # TypeScript em todos os workspaces
pnpm turbo format                           # Prettier (check)
pnpm turbo format:fix                       # Prettier (fix)

# Build
pnpm turbo build                            # Build de produção (Turborepo)
pnpm turbo --filter @essencia/api build     # Build apenas API

# Testes
pnpm turbo test                             # Todos os testes (Turborepo)
pnpm turbo test:watch                       # Watch mode
pnpm turbo --filter @essencia/api test      # Testes apenas API
pnpm turbo --filter @essencia/planejamento test  # Testes apenas Planejamento

# E2E
pnpm turbo e2e                              # Playwright (todos os testes)
pnpm turbo e2e --ui                         # Playwright com UI
pnpm turbo e2e --grep "Planejamento"        # Filtrar por nome

# Database
pnpm turbo db:generate                      # Gerar migration
pnpm turbo db:migrate                       # Aplicar migrations
pnpm turbo db:studio                        # Drizzle Studio (http://localhost:4983)
pnpm turbo db:seed                          # Popular dados de teste

# Ciclo completo de qualidade
pnpm turbo quality                          # format + lint + typecheck + test
```

**Nomes reais de workspaces (para --filter):**

| Workspace    | Tipo     | Filtro                   |
| ------------ | -------- | ------------------------ |
| API          | Backend  | `@essencia/api`          |
| Home         | Frontend | `@essencia/home`         |
| Login        | Frontend | `@essencia/login`        |
| Usuários     | Frontend | `@essencia/usuarios`     |
| Escolas      | Frontend | `@essencia/escolas`      |
| Planejamento | Frontend | `@essencia/planejamento` |
| UI           | Package  | `@essencia/ui`           |
| DB           | Package  | `@essencia/db`           |
| Shared       | Package  | `@essencia/shared`       |

**Verificar scripts disponíveis:**

```bash
cat package.json | jq '.scripts'
pnpm turbo run --list
```

### Estrutura de Testes

```
╔═══════════════════════════════════════════════════════════════════╗
║  ONDE VIVEM OS TESTES                                             ║
╚═══════════════════════════════════════════════════════════════════╝
```

| Tipo de Teste | Ferramenta | Localização                      | Comando                                     |
| ------------- | ---------- | -------------------------------- | ------------------------------------------- |
| **Unit BE**   | Jest       | `services/api/src/**/*.spec.ts`  | `pnpm --filter @essencia/api test`          |
| **Unit FE**   | Vitest     | `apps/*/src/**/*.test.tsx`       | `pnpm --filter @essencia/planejamento test` |
| **Unit FE**   | Vitest     | `apps/*/__tests__/**/*.test.tsx` | `pnpm --filter @essencia/planejamento test` |
| **E2E**       | Playwright | `e2e/**/*.spec.ts`               | `pnpm e2e`                                  |
| **Package**   | Vitest     | `packages/*/src/**/*.test.ts`    | `pnpm --filter @essencia/shared test`       |

**Setup de Mocking:**

| Camada   | Ferramenta | Uso                                     |
| -------- | ---------- | --------------------------------------- |
| Backend  | Jest       | `jest.mock()`, supertest para HTTP      |
| Frontend | Vitest     | MSW (Mock Service Worker) para API      |
| E2E      | Playwright | Interceptação de rede quando necessário |

**Exemplo de setup MSW (Frontend):**

```typescript
// apps/planejamento/src/test/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/plannings", () => {
    return HttpResponse.json({
      success: true,
      data: [{ id: "1", turma: "Infantil 3A" }],
    });
  }),
];
```

**Verificar configuração de testes:**

```bash
cat services/api/jest.config.js
cat apps/planejamento/vitest.config.ts
cat e2e/playwright.config.ts
```

### Portas de Desenvolvimento

| Serviço        | Porta | Workspace                |
| -------------- | ----- | ------------------------ |
| home           | 3000  | `@essencia/home`         |
| api            | 3001  | `@essencia/api`          |
| login          | 3003  | `@essencia/login`        |
| usuarios       | 3004  | `@essencia/usuarios`     |
| escolas        | 3005  | `@essencia/escolas`      |
| turmas         | 3006  | `@essencia/turmas`       |
| planejamento   | 3007  | `@essencia/planejamento` |
| PostgreSQL     | 5432  | —                        |
| Redis          | 6379  | —                        |
| Drizzle Studio | 4983  | —                        |

### Convenções de Código

| Item              | Convenção                     |
| ----------------- | ----------------------------- |
| Domínio           | PT-BR (turma, quinzena, etc.) |
| Componentes React | PascalCase                    |
| Arquivos          | kebab-case                    |
| Schemas Zod       | `schemas.ts`                  |
| Forms             | react-hook-form + zodResolver |

### Conventional Commits

```
feat(planejamento): add auto-save functionality
fix(api): handle null user in session
chore(ci): update GitHub Actions workflow
docs(readme): update installation steps
refactor(auth): simplify guard logic
test(usuarios): add unit tests for CRUD
```

---

## 📤 Formato de Entrega

Toda resposta deve seguir esta estrutura:

````markdown
## 1. Resumo

[1-3 linhas descrevendo a mudança]

## 2. Plano de Execução

1. [Passo 1]
2. [Passo 2]
   ...

## 3. Arquivos Afetados

- `path/to/file1.ts`
- `path/to/file2.tsx`

## 4. Mudanças Detalhadas

### [Arquivo/Módulo]

[Código ou descrição da mudança]

## 5. Testes e Comandos

```bash
pnpm test --filter <modulo>
pnpm lint
```

## 6. Riscos / Rollback

[Riscos identificados e estratégia de rollback]

## 7. Guardrails Aplicados

- [ ] Sem import proibido apps/\*\* → packages/db
- [ ] RBAC + Tenant respeitados
- [ ] Inputs validados
- [ ] Estados UI: loading/empty/error
- [ ] `pnpm turbo format` executado
- [ ] `pnpm turbo lint` passando
- [ ] `pnpm turbo typecheck` passando
- [ ] `pnpm turbo build` passando

## 8. Testes Realizados ⚠️ OBRIGATÓRIO

- [ ] Testes unitários adicionados/atualizados
- [ ] Testes de integração (se aplicável)
- [ ] Testes E2E (se feature crítica)
- [ ] `pnpm turbo test` passando

**Testes Adicionados (LISTAR TODOS):**
| Arquivo de Teste | Cenários Cobertos |
|------------------|-------------------|
| `example.spec.ts` | 401, 403, 200, edge cases |

⛔ **Se esta seção estiver vazia em implementação grande = ENTREGA INCOMPLETA**

## 9. Ciclo de Qualidade

- [ ] `pnpm turbo format` ✅
- [ ] `pnpm turbo lint` ✅
- [ ] `pnpm turbo typecheck` ✅
- [ ] `pnpm turbo build` ✅
- [ ] `pnpm turbo test` ✅

## 10. Documentação Atualizada

- [ ] API.md (se criou/alterou endpoints)
- [ ] DATABASE.md (se alterou schema)
- [ ] SECURITY.md (se mudou auth/RBAC)
- [ ] CHANGELOG.md (sempre)
- [ ] README.md (se necessário)

## 11. Doc Drift (se houver)

[Inconsistências encontradas e patches sugeridos]

## 12. Commit Message

```
type(scope): description
```
````

---

## 🚫 Saídas Proibidas

O agente **NUNCA** deve produzir:

| Proibido                             | Motivo                      |
| ------------------------------------ | --------------------------- |
| Import de `packages/db` em `apps/**` | Viola governança de dados   |
| Bypass de RBAC/tenant                | Falha de segurança          |
| Logs de cookies/sessões em texto     | Vazamento de credenciais    |
| `DROP`/deleções sem migração         | Perda de dados              |
| Endpoints não documentados           | Inconsistência arquitetural |
| SQL interpolado manualmente          | Vulnerabilidade de injeção  |

---

## 📝 Template de PR

```markdown
## O que muda

[Descrição clara da mudança]

## Por que

[Motivação / problema resolvido]

## Como testar

1. [Passo 1]
2. [Passo 2]

## Riscos / Rollback

[Riscos e estratégia de reversão]

## Checklist

- [ ] Docs atualizados
- [ ] RBAC/Tenant validado
- [ ] Testes passando
- [ ] Sem conflitos
```

---

## 🔧 Troubleshooting

### Fluxo de Diagnóstico Geral

```
╔═══════════════════════════════════════════════════════════════════╗
║  QUANDO ENCONTRAR UM ERRO, SIGA ESTE FLUXO                       ║
╚═══════════════════════════════════════════════════════════════════╝
```

```
┌─────────────────────────────────────────────────────────────────┐
│  1. IDENTIFICAR: Qual comando/operação falhou?                  │
│  2. LER: Ler a mensagem de erro COMPLETA                        │
│  3. LOCALIZAR: Em qual arquivo/linha ocorreu?                   │
│  4. BUSCAR: Existe padrão similar funcionando no repo?          │
│  5. COMPARAR: O que está diferente do padrão?                   │
│  6. CORRIGIR: Aplicar a correção                                │
│  7. VALIDAR: Executar comando novamente                         │
│  8. DOCUMENTAR: Se erro novo, documentar solução                │
└─────────────────────────────────────────────────────────────────┘
```

---

### Erros de Lint (ESLint)

#### Erro: `'X' is defined but never used`

```bash
# Diagnóstico
pnpm lint 2>&1 | grep "is defined but never used"

# Solução 1: Remover import/variável não usada
# Solução 2: Se for intencional, prefixar com underscore
const _unusedVar = value;

# Solução 3: Desabilitar para linha específica (último recurso)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
```

#### Erro: `Missing return type on function`

```typescript
// ⛔ ERRADO
async function getUser(id: string) {
  return await db.query.users.findFirst({ where: eq(users.id, id) });
}

// ✅ CORRETO
async function getUser(id: string): Promise<User | undefined> {
  return await db.query.users.findFirst({ where: eq(users.id, id) });
}
```

#### Erro: `Unexpected any. Specify a different type`

```typescript
// ⛔ ERRADO
function process(data: any) { ... }

// ✅ CORRETO
function process(data: unknown) { ... }
// ou
function process<T extends Record<string, unknown>>(data: T) { ... }
```

**Comando para auto-fix:**

```bash
pnpm lint --fix
# ou para workspace específico
pnpm --filter @essencia/api lint --fix
```

---

### Erros de TypeScript (typecheck)

#### Erro: `Type 'X' is not assignable to type 'Y'`

```bash
# Diagnóstico
pnpm typecheck 2>&1 | grep -A 5 "is not assignable"

# Passos para resolver:
# 1. Verificar tipo esperado vs tipo fornecido
# 2. Buscar definição do tipo no repo
rg "type Y = " packages/shared/src -n
rg "interface Y " packages/shared/src -n

# 3. Verificar se precisa de conversão/assertion
```

```typescript
// Exemplo de correção
// ⛔ ERRADO
const user: User = response.data; // response.data é unknown

// ✅ CORRETO (com validação)
const user = userSchema.parse(response.data);
// ou
const user = response.data as User; // apenas se tiver certeza
```

#### Erro: `Property 'X' does not exist on type 'Y'`

```bash
# Diagnóstico: verificar definição do tipo
rg "interface Y" packages/shared/src -n
rg "type Y" packages/shared/src -n

# Solução 1: Adicionar propriedade ao tipo (se fizer sentido)
# Solução 2: Usar optional chaining se propriedade pode não existir
const value = obj?.x;

# Solução 3: Type guard
if ('x' in obj) {
  console.log(obj.x);
}
```

#### Erro: `Cannot find module 'X' or its corresponding type declarations`

```bash
# Diagnóstico
# 1. Verificar se pacote está instalado
cat package.json | grep "X"

# 2. Verificar se tipos existem
pnpm add -D @types/X

# 3. Se for módulo interno, verificar path alias
cat tsconfig.json | grep "paths"

# 4. Verificar exports do pacote
cat packages/shared/package.json | grep "exports"
```

---

### Erros de Build

#### Erro: `Module not found: Can't resolve 'X'`

```bash
# Diagnóstico
pnpm build 2>&1 | grep "Module not found"

# Causas comuns:
# 1. Import com path errado
# 2. Dependência não instalada
# 3. Dependência em devDependencies que deveria estar em dependencies
# 4. Turborepo não rebuildeou pacote dependente

# Soluções:
pnpm install                          # Reinstalar dependências
pnpm --filter @essencia/shared build  # Rebuildar pacote específico
pnpm build --force                    # Forçar rebuild sem cache
```

#### Erro: `Build optimization failed` (Next.js)

```bash
# Diagnóstico
pnpm --filter @essencia/planejamento build 2>&1 | tail -50

# Causas comuns:
# 1. Import de server-only em client component
# 2. Import de client-only em server component
# 3. Dependência com side effects no build

# Soluções:
# 1. Verificar 'use client' / 'use server' nos componentes
rg "'use client'" apps/planejamento/src -l
rg "'use server'" apps/planejamento/src -l

# 2. Verificar imports
rg "import.*from '@essencia/db'" apps/planejamento -n  # PROIBIDO!
```

#### Erro: Turborepo cache inválido

```bash
# Sintoma: Build passa local mas falha no CI, ou vice-versa

# Solução: Limpar cache
rm -rf node_modules/.cache
rm -rf .turbo
pnpm install
pnpm build
```

---

### Erros de Teste

#### Erro: `Test suite failed to run`

```bash
# Diagnóstico
pnpm test 2>&1 | grep -A 10 "failed to run"

# Causas comuns:
# 1. Erro de sintaxe no arquivo de teste
# 2. Import de módulo que não existe
# 3. Setup de teste faltando

# Soluções:
# 1. Verificar configuração de teste
cat services/api/jest.config.js
cat apps/planejamento/vitest.config.ts

# 2. Verificar setup files
cat services/api/src/test/setup.ts
```

#### Erro: `Expected X but received Y`

```bash
# Diagnóstico: entender o que mudou
# 1. O comportamento mudou (precisa atualizar teste)?
# 2. Ou introduziu um bug (precisa corrigir código)?

# Se comportamento mudou intencionalmente:
# Atualizar o teste com novo valor esperado

# Se é um bug:
# Corrigir o código, não o teste
```

#### Erro: `Timeout - Async callback was not invoked`

```typescript
// ⛔ ERRADO: Promise não resolvida
it("should fetch data", async () => {
  const data = fetchData(); // Faltou await
  expect(data).toBeDefined();
});

// ✅ CORRETO
it("should fetch data", async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// ✅ CORRETO: Aumentar timeout se operação é lenta
it("should process large file", async () => {
  // ...
}, 30000); // 30 segundos
```

#### Erro: Teste passa local, falha no CI

```bash
# Causas comuns:
# 1. Dependência de ordem de execução
# 2. Dependência de timezone/locale
# 3. Dependência de dados de teste não isolados
# 4. Race condition

# Soluções:
# 1. Garantir que cada teste é independente
# 2. Usar beforeEach para resetar estado
# 3. Usar mocks consistentes
# 4. Verificar timezone no CI
TZ=UTC pnpm turbo test
```

---

### Erros de Database/Migration

#### Erro: `relation "X" does not exist`

```bash
# Diagnóstico
pnpm turbo db:studio  # Verificar se tabela existe

# Causas:
# 1. Migration não foi executada
# 2. Migration foi executada em banco diferente
# 3. Tabela foi dropada manualmente

# Solução
pnpm turbo db:migrate
```

#### Erro: `column "X" of relation "Y" already exists`

```bash
# Causa: Tentando adicionar coluna que já existe

# Solução 1: Verificar estado atual do banco
pnpm turbo db:studio

# Solução 2: Se migration está incorreta, criar nova migration para corrigir
# NUNCA editar migration já aplicada em produção
```

#### Erro: `migration failed`

```bash
# Diagnóstico
pnpm turbo db:migrate 2>&1 | tail -30

# Passos:
# 1. Identificar qual migration falhou
# 2. Verificar o SQL gerado
cat packages/db/drizzle/*.sql

# 3. Se for desenvolvimento, pode resetar
pnpm turbo db:push --force  # CUIDADO: perde dados

# 4. Se for produção, criar migration corretiva
```

---

### Erros de Runtime (API/Frontend)

#### Erro 401: `Unauthorized`

```bash
# Diagnóstico
# 1. Verificar se sessão existe
# 2. Verificar se cookie está sendo enviado

# No frontend, verificar:
# - credentials: 'include' no fetch
# - CORS configurado corretamente

# No backend, verificar:
rg "AuthGuard" services/api/src -n
# - Guard está aplicado no endpoint?
# - Sessão está sendo validada corretamente?
```

#### Erro 403: `Forbidden`

```bash
# Diagnóstico: Role ou Tenant incorreto

# 1. Verificar qual guard retornou 403
# - RolesGuard: usuário não tem role permitida
# - TenantGuard: usuário tentando acessar outro tenant

# 2. Verificar roles permitidas no endpoint
rg "@Roles" services/api/src/modules/<modulo> -n

# 3. Verificar dados da sessão
# Log (apenas em dev):
console.log('Session:', { role: session.role, unitId: session.unitId });
```

#### Erro 500: `Internal Server Error`

```bash
# Diagnóstico
# 1. Verificar logs da API
pnpm --filter @essencia/api dev  # Ver console

# 2. Buscar stack trace completo
# 3. Identificar linha/arquivo do erro
# 4. Verificar se é erro de:
#    - Banco de dados (conexão, query)
#    - Validação não tratada
#    - Null/undefined não esperado

# Correção comum:
# Adicionar try/catch e retornar erro apropriado
try {
  // operação
} catch (error) {
  throw new InternalServerErrorException({
    code: ErrorCode.DATABASE_ERROR,
    message: 'Erro ao processar requisição',
  });
}
```

#### Erro: `CORS error`

```bash
# Sintoma: Request blocked by CORS policy

# Diagnóstico
# 1. Verificar configuração CORS na API
rg "cors" services/api/src/main.ts -n

# 2. Verificar se origem está na lista permitida
# 3. Verificar se credentials está habilitado

# Solução (services/api/src/main.ts):
app.enableCors({
  origin: ['http://localhost:3000', 'http://localhost:3007'],
  credentials: true,
});
```

---

### Erros de Dependências

#### Erro: `peer dependency conflict`

```bash
# Diagnóstico
pnpm install 2>&1 | grep "peer"

# Solução 1: Verificar versões compatíveis
pnpm why <package>

# Solução 2: Adicionar override no package.json raiz
{
  "pnpm": {
    "overrides": {
      "<package>": "<version>"
    }
  }
}
```

#### Erro: `Cannot find module` após instalar pacote

```bash
# Causas:
# 1. Pacote instalado no workspace errado
# 2. Turborepo cache desatualizado

# Solução
pnpm turbo install
pnpm turbo build --force
```

---

### Tabela de Referência Rápida

| Erro                 | Causa Comum           | Comando de Diagnóstico  | Solução Rápida              |
| -------------------- | --------------------- | ----------------------- | --------------------------- |
| `unused variable`    | Import não usado      | `pnpm turbo lint`       | Remover ou prefixar `_`     |
| `not assignable`     | Tipo incorreto        | `pnpm turbo typecheck`  | Verificar definição do tipo |
| `Module not found`   | Dependência faltando  | `pnpm turbo install`    | Instalar pacote             |
| `Test timeout`       | Await faltando        | `pnpm turbo test`       | Adicionar await             |
| `relation not exist` | Migration pendente    | `pnpm turbo db:migrate` | Executar migrations         |
| `401 Unauthorized`   | Sessão inválida       | Verificar cookie        | Verificar AuthGuard         |
| `403 Forbidden`      | Role/Tenant errado    | Verificar logs          | Verificar guards            |
| `500 Internal`       | Erro não tratado      | Ver logs da API         | Adicionar try/catch         |
| `CORS error`         | Origem não permitida  | Verificar main.ts       | Adicionar origem            |
| `peer conflict`      | Versões incompatíveis | `pnpm why X`            | Adicionar override          |

---

### Quando Escalar

Se após seguir o fluxo de diagnóstico o erro persistir:

1. **Documentar** o que foi tentado
2. **Buscar** no histórico do repo (issues, PRs)
3. **Perguntar** ao humano com contexto completo:
   - Comando executado
   - Mensagem de erro completa
   - Arquivos envolvidos
   - O que já foi tentado

---

## 👁 Observabilidade

### Contrato de Observabilidade

```
╔═══════════════════════════════════════════════════════════════════╗
║  📊 Todo código de produção DEVE seguir as regras de logging     ║
╚═══════════════════════════════════════════════════════════════════╝
```

#### 1. Correlation ID por Request

Cada request deve ter um ID único para rastreabilidade:

```typescript
// Middleware de correlation ID (já implementado)
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers["x-correlation-id"] || randomUUID();
    req["correlationId"] = correlationId;
    res.setHeader("x-correlation-id", correlationId);
    next();
  }
}
```

#### 2. Regras de Log Seguro

| ✅ Pode logar                        | ⛔ NUNCA logar              |
| ------------------------------------ | --------------------------- |
| `correlationId`                      | Senha (plaintext ou hash)   |
| `userId` (UUID)                      | Token de sessão             |
| `schoolId`, `unitId`                 | Cookie completo             |
| `role`                               | Email (usar hash truncado)  |
| `endpoint` + `method`                | CPF, RG, dados pessoais     |
| `statusCode`                         | Payload com dados sensíveis |
| `responseTime`                       | Stack trace com secrets     |
| Hash truncado: `email.slice(0,3)***` | Headers de autorização      |

#### 3. Eventos Obrigatórios

Todo endpoint DEVE emitir logs para estes eventos:

```typescript
// Padrão de log estruturado
const log = {
  correlationId: req.correlationId,
  timestamp: new Date().toISOString(),
  event: 'AUTH_FAIL' | 'FORBIDDEN' | 'TENANT_MISMATCH' | 'ERROR_5XX' | 'SUCCESS',
  context: {
    endpoint: '/plannings/submit',
    method: 'POST',
    userId: session?.userId,
    role: session?.role,
    schoolId: session?.schoolId,
    unitId: session?.unitId,
  },
  // Apenas para erros:
  error?: {
    code: 'VALIDATION_ERROR',
    message: 'Campo turma é obrigatório',
    // Nunca incluir stack trace com secrets
  }
};
```

**Eventos mínimos:**

| Evento             | Quando                                     | Severidade |
| ------------------ | ------------------------------------------ | ---------- |
| `AUTH_FAIL`        | 401 — sessão inválida/expirada             | WARN       |
| `FORBIDDEN`        | 403 — role sem permissão                   | WARN       |
| `TENANT_MISMATCH`  | 403 — tentativa de acesso cross-tenant     | WARN       |
| `VALIDATION_ERROR` | 400 — payload inválido                     | INFO       |
| `NOT_FOUND`        | 404 — recurso não existe                   | INFO       |
| `ERROR_5XX`        | 500+ — erro interno                        | ERROR      |
| `SUCCESS`          | 200/201 — operação bem-sucedida (opcional) | DEBUG      |

#### 4. Exemplo de Implementação

```typescript
// services/api/src/common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, correlationId } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        this.logger.log({
          correlationId,
          event: "SUCCESS",
          method,
          url,
          statusCode: res.statusCode,
          responseTime: `${Date.now() - now}ms`,
        });
      }),
      catchError((error) => {
        this.logger.error({
          correlationId,
          event: this.getEventType(error),
          method,
          url,
          error: {
            code: error.code || "UNKNOWN",
            message: error.message,
          },
        });
        throw error;
      }),
    );
  }
}
```

**Verificar implementação:**

```bash
# Correlation ID
rg "correlationId" services/api/src -n
rg "x-correlation-id" services/api/src -n
cat services/api/src/common/middleware/correlation-id.middleware.ts

# Logging Interceptor
rg "LoggingInterceptor" services/api/src -n
cat services/api/src/common/interceptors/logging.interceptor.ts

# Filtros de exceção
rg "ExceptionFilter" services/api/src -n
cat services/api/src/common/filters/http-exception.filter.ts
```

#### 5. Checklist de Observabilidade por Endpoint

Ao criar/modificar endpoint, verificar:

```
┌─────────────────────────────────────────────────────────────────┐
│  OBSERVABILIDADE POR ENDPOINT                                   │
├─────────────────────────────────────────────────────────────────┤
│  □ LoggingInterceptor aplicado (global ou no controller)        │
│  □ CorrelationId propagado em chamadas internas                 │
│  □ Erros logados com código e mensagem (sem stack sensível)     │
│  □ Tempo de resposta capturado                                  │
│  □ Eventos 4xx logados como WARN                                │
│  □ Eventos 5xx logados como ERROR                               │
│  □ Nenhum dado sensível no log                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 CI/CD

### Pipeline como Extensão do AGENTS.md

```
╔═══════════════════════════════════════════════════════════════════╗
║  PR só é VERDE se passar todo o ciclo de qualidade               ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Verificar configuração:**

```bash
cat .github/workflows/ci.yml
cat .github/workflows/deploy.yml
```

### Jobs Obrigatórios no CI

| Job         | Comando                | Bloqueia PR?              |
| ----------- | ---------------------- | ------------------------- |
| `lint`      | `pnpm turbo lint`      | ✅ Sim                    |
| `typecheck` | `pnpm turbo typecheck` | ✅ Sim                    |
| `test`      | `pnpm turbo test`      | ✅ Sim                    |
| `build`     | `pnpm turbo build`     | ✅ Sim                    |
| `e2e`       | `pnpm turbo e2e`       | ✅ Sim (para PRs em main) |

### Workflow de CI Esperado

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"

      - run: pnpm turbo install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck
      - run: pnpm turbo test
      - run: pnpm turbo build
  e2e:
    runs-on: ubuntu-latest
    needs: quality
    if: github.base_ref == 'main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm turbo install --frozen-lockfile
      - run: pnpm turbo e2e
```

### Regras de Merge

| Branch Target | Requer CI Verde? | Requer Review?  | Requer E2E? |
| ------------- | ---------------- | --------------- | ----------- |
| `develop`     | ✅ Sim           | ✅ 1 aprovação  | ❌ Não      |
| `main`        | ✅ Sim           | ✅ 2 aprovações | ✅ Sim      |

---

## 📚 Documentação Obrigatória (Links)

| Documento           | Path                          | Quando Atualizar                |
| ------------------- | ----------------------------- | ------------------------------- |
| API                 | `docs/API.md`                 | Criar/alterar endpoint          |
| Database            | `docs/DATABASE.md`            | Alterar schema                  |
| Security            | `docs/SECURITY.md`            | Mudar auth/RBAC/sessão          |
| Changelog           | `docs/CHANGELOG.md`           | **SEMPRE** (toda PR)            |
| Architecture        | `docs/ARCHITECTURE.md`        | Novo módulo/mudança estrutural  |
| Deployment          | `docs/DEPLOYMENT.md`          | Mudar infra/deploy              |
| Module Planejamento | `docs/MODULO_PLANEJAMENTO.md` | Alterar módulo de planejamento  |
| Contributing        | `docs/CONTRIBUTING.md`        | Mudar processo de contribuição  |
| README              | `README.md`                   | Mudar setup/estrutura principal |

**Verificar docs existentes:**

```bash
ls -la docs/
cat docs/API.md | head -50
```

---

## 🔄 Manutenção deste Documento

Quando mudar stack, portas, scripts ou estratégia:

1. Atualizar este `AGENTS.md`
2. Atualizar `docs/DEPLOYMENT.md` / `docs/ARCHITECTURE.md`
3. Atualizar `README.md`
4. Registrar no `docs/CHANGELOG.md`

**Meta: Zero drift entre documentação e execução real.**

---

<div align="center">

**Portal Digital Colégio Essência Feliz**

</div>
