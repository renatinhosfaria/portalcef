# Guia de Contribuição

Obrigado por considerar contribuir para o Portal Digital Colégio Essência Feliz! Este documento fornece diretrizes para contribuições ao projeto.

---

## 📋 Índice

1. [Código de Conduta](#código-de-conduta)
2. [Como Posso Contribuir?](#como-posso-contribuir)
3. [Workflow de Desenvolvimento](#workflow-de-desenvolvimento)
4. [Padrões de Código](#padrões-de-código)
5. [Conventional Commits](#conventional-commits)
6. [Ciclo de Qualidade](#ciclo-de-qualidade)
7. [Testes](#testes)
8. [Pull Requests](#pull-requests)
9. [Code Review](#code-review)
10. [Documentação](#documentação)

---

## Código de Conduta

Este projeto segue um código de conduta para garantir um ambiente acolhedor e respeitoso para todos. Ao participar, você concorda em:

- Ser respeitoso e profissional
- Aceitar críticas construtivas
- Focar no que é melhor para a comunidade
- Mostrar empatia com outros membros

---

## Como Posso Contribuir?

### Reportando Bugs

Ao reportar um bug, inclua:

- **Descrição clara**: O que aconteceu vs. o que deveria acontecer
- **Passos para reproduzir**: Lista numerada de passos
- **Ambiente**: SO, versão do Node, navegador
- **Screenshots**: Se aplicável
- **Logs**: Mensagens de erro completas

**Template de Issue:**

```markdown
## Descrição
[Descrição clara do bug]

## Passos para Reproduzir
1. Vá para '...'
2. Clique em '...'
3. Veja o erro

## Comportamento Esperado
[O que deveria acontecer]

## Comportamento Atual
[O que acontece]

## Ambiente
- OS: [e.g. Ubuntu 22.04]
- Node: [e.g. 22.0.0]
- Browser: [e.g. Chrome 120]

## Screenshots
[Se aplicável]

## Logs
```
[Cole logs aqui]
```
```

### Sugerindo Melhorias

Para sugerir uma melhoria:

- **Verifique se já existe**: Busque em issues abertas
- **Descreva o caso de uso**: Por que é útil?
- **Proponha uma solução**: Como poderia funcionar?
- **Considere alternativas**: Existem outras abordagens?

### Implementando Features

Para implementar uma nova feature:

1. **Abra uma issue primeiro** para discussão
2. **Aguarde aprovação** antes de começar a codificar
3. **Siga os padrões** descritos neste guia
4. **Inclua testes** e documentação
5. **Abra um Pull Request**

---

## Workflow de Desenvolvimento

### 1. Setup Inicial

```bash
# Fork o repositório no GitHub
# Clone seu fork
git clone https://github.com/seu-usuario/portalessencia.git
cd portalessencia

# Adicione o upstream
git remote add upstream https://github.com/renatinhosfaria/portalessencia.git

# Instale dependências
pnpm install

# Configure variáveis de ambiente
cp .env.example .env

# Inicie infraestrutura (Docker)
pnpm docker:up

# Execute migrations
pnpm db:migrate

# Inicie desenvolvimento
pnpm dev
```

### 2. Criando uma Branch

```bash
# Atualize main
git checkout main
git pull upstream main

# Crie uma branch descritiva
git checkout -b feat/nome-da-feature
# ou
git checkout -b fix/nome-do-bug
```

**Padrão de nomes de branch:**

- `feat/descricao` - Nova feature
- `fix/descricao` - Bug fix
- `refactor/descricao` - Refatoração
- `docs/descricao` - Documentação
- `test/descricao` - Testes
- `chore/descricao` - Tarefas de manutenção

### 3. Desenvolvimento

```bash
# Faça suas mudanças
# Teste localmente
pnpm dev

# Verifique qualidade
pnpm turbo format
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

### 4. Commit

```bash
# Stage suas mudanças
git add .

# Commit com mensagem no formato Conventional Commits
git commit -m "feat(planejamento): add export to PDF feature"
```

### 5. Push e Pull Request

```bash
# Push para seu fork
git push origin feat/nome-da-feature

# Abra Pull Request no GitHub
# Preencha o template completamente
```

---

## Padrões de Código

### TypeScript

- **Sempre use TypeScript** - Sem `any`, prefira `unknown`
- **Tipos explícitos** em funções públicas
- **Interfaces** para objetos, **types** para unions/intersections

```typescript
// ✅ BOM
interface UserProps {
  name: string;
  email: string;
}

function createUser(props: UserProps): User {
  // ...
}

// ❌ RUIM
function createUser(props: any) {
  // ...
}
```

### Nomenclatura

| Tipo           | Convenção      | Exemplo             |
| -------------- | -------------- | ------------------- |
| Variáveis      | camelCase      | `userData`          |
| Constantes     | camelCase      | `maxRetries`        |
| Funções        | camelCase      | `fetchUsers()`      |
| Componentes    | PascalCase     | `UserCard`          |
| Tipos/Interfaces | PascalCase   | `UserData`          |
| Arquivos       | kebab-case     | `user-card.tsx`     |
| Pastas         | kebab-case     | `user-management/`  |
| Classes        | PascalCase     | `UserService`       |
| Enums          | PascalCase     | `OrderStatus`       |

### Imports

**Ordem de imports:**

```typescript
// 1. External libs
import { useState } from 'react';
import { z } from 'zod';

// 2. Internal packages
import { Button } from '@essencia/ui';
import { userSchema } from '@essencia/shared';

// 3. Relative imports
import { UserCard } from './user-card';
import type { UserProps } from './types';
```

### Componentes React

```typescript
// ✅ BOM - Componente funcional com tipos
interface UserCardProps {
  user: User;
  onEdit?: (id: string) => void;
}

export function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div>
      <h3>{user.name}</h3>
      {onEdit && <button onClick={() => onEdit(user.id)}>Editar</button>}
    </div>
  );
}

// ❌ RUIM - Sem tipos, default export
export default function UserCard(props) {
  return <div>{props.user.name}</div>;
}
```

### Backend (NestJS)

```typescript
// ✅ BOM - Controller com decorators corretos
@Controller('users')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('gerente_unidade', 'diretora_geral', 'master')
  async findAll(@CurrentUser() user: SessionData) {
    return this.usersService.findByUnit(user.unitId);
  }
}

// ❌ RUIM - Sem guards, sem tipos
@Controller('users')
export class UsersController {
  @Get()
  async findAll(@Req() req) {
    return this.usersService.findAll();
  }
}
```

---

## Conventional Commits

### Formato

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Descrição                              | Exemplo                                    |
| ---------- | -------------------------------------- | ------------------------------------------ |
| `feat`     | Nova feature                           | `feat(auth): add two-factor authentication` |
| `fix`      | Bug fix                                | `fix(api): handle null user in session`    |
| `docs`     | Documentação                           | `docs(readme): update installation steps`  |
| `style`    | Formatação (sem mudança de lógica)     | `style(lint): fix eslint warnings`         |
| `refactor` | Refatoração                            | `refactor(auth): simplify guard logic`     |
| `perf`     | Melhoria de performance                | `perf(api): optimize database queries`     |
| `test`     | Adicionar/corrigir testes              | `test(users): add unit tests for CRUD`     |
| `chore`    | Manutenção (deps, configs, etc.)       | `chore(deps): update dependencies`         |
| `build`    | Build system ou dependências externas  | `build(docker): optimize Dockerfile`       |
| `ci`       | CI/CD                                  | `ci(github): add deploy workflow`          |
| `revert`   | Reverter commit anterior               | `revert: revert "feat(auth): add 2FA"`     |

### Scopes Comuns

- `auth`, `users`, `schools`, `turmas`, `planejamento`, `calendario`, `shop`
- `api`, `db`, `ui`, `shared`, `components`
- `docker`, `nginx`, `deps`, `docs`

### Exemplos

```bash
# Feature nova
git commit -m "feat(planejamento): add export to PDF functionality"

# Bug fix
git commit -m "fix(auth): prevent session expiration on active users"

# Breaking change
git commit -m "feat(api): change authentication to JWT

BREAKING CHANGE: Cookie-based auth is no longer supported. Migrate to JWT tokens."

# Múltiplas mudanças relacionadas
git commit -m "refactor(shop): improve order processing

- Extract payment logic to separate service
- Add inventory validation
- Update tests"
```

---

## Ciclo de Qualidade

### Obrigatório Antes de Cada Commit

```bash
# 1. Formatar código
pnpm turbo format

# 2. Corrigir lint
pnpm turbo lint --fix

# 3. Verificar tipos
pnpm turbo typecheck

# 4. Build de produção
pnpm turbo build

# 5. Executar testes
pnpm turbo test
```

**Atalho (execute todos de uma vez):**

```bash
pnpm turbo format && pnpm turbo lint && pnpm turbo typecheck && pnpm turbo build && pnpm turbo test
```

### ESLint

O projeto usa ESLint com regras estritas. Erros comuns:

```typescript
// ❌ ERRO: 'x' is defined but never used
const x = 10;

// ✅ CORREÇÃO 1: Remover variável
// (nenhum código)

// ✅ CORREÇÃO 2: Prefixar com underscore se intencional
const _x = 10;
```

### TypeScript

```typescript
// ❌ ERRO: Type 'any' is not allowed
function process(data: any) {}

// ✅ CORREÇÃO
function process(data: unknown) {}
// ou
function process<T>(data: T) {}
```

---

## Testes

### Cobertura Obrigatória

| Tipo de Implementação | Testes Obrigatórios |
| --------------------- | ------------------- |
| **Bug fix**           | Teste de regressão (reproduz o bug)  |
| **Novo endpoint**     | 401, 403 (role), 403 (tenant), 400, 404, 200/201 |
| **Novo componente**   | Renderização, estados (loading/error/empty), interações |
| **Nova feature grande** | Suite completa + E2E |

### Backend (Jest)

```typescript
// users.controller.spec.ts
describe('UsersController', () => {
  describe('GET /users', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/users');
      expect(response.status).toBe(401);
    });

    it('should return 403 when role is not allowed', async () => {
      const response = await request(app)
        .get('/users')
        .set('Cookie', auxiliarSession);
      expect(response.status).toBe(403);
    });

    it('should return 403 when accessing different tenant', async () => {
      const response = await request(app)
        .get('/users')
        .set('Cookie', userFromUnitBSession);
      expect(response.status).toBe(403);
    });

    it('should return 200 and users list when authorized', async () => {
      const response = await request(app)
        .get('/users')
        .set('Cookie', gerenteSession);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
```

### Frontend (Vitest)

```typescript
// UserCard.test.tsx
import { render, screen, userEvent } from '@testing-library/react';
import { UserCard } from './user-card';

describe('UserCard', () => {
  it('should render user name', () => {
    render(<UserCard user={{ id: '1', name: 'João' }} />);
    expect(screen.getByText('João')).toBeInTheDocument();
  });

  it('should call onEdit when button is clicked', async () => {
    const onEdit = vi.fn();
    render(<UserCard user={{ id: '1', name: 'João' }} onEdit={onEdit} />);

    await userEvent.click(screen.getByText('Editar'));
    expect(onEdit).toHaveBeenCalledWith('1');
  });
});
```

### E2E (Playwright)

```typescript
// planejamento.spec.ts
import { test, expect } from '@playwright/test';

test('should create planning as professora', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=email]', 'professora@escola.com');
  await page.fill('[name=password]', 'senha123');
  await page.click('button[type=submit]');

  // Navegar para wizard
  await page.click('text=Novo Planejamento');

  // Preencher step 1
  await page.selectOption('[name=turma]', 'Infantil 3A');
  await page.selectOption('[name=quinzena]', '2026-Q01');
  await page.click('text=Próximo');

  // Preencher step 2
  await page.fill('[name=objetivos]', 'Desenvolver habilidades...');
  await page.click('text=Próximo');

  // ... preencher todos os steps

  // Submeter
  await page.click('text=Enviar para Coordenação');
  await expect(page.locator('.toast-success')).toBeVisible();
});
```

### Executar Testes

```bash
# Todos os testes
pnpm turbo test

# Testes com cobertura
pnpm turbo test --coverage

# Testes de um módulo específico
pnpm turbo --filter @essencia/api test
pnpm turbo --filter planejamento test

# Watch mode
pnpm turbo test --watch

# E2E
pnpm e2e

# E2E com UI
pnpm e2e --ui
```

---

## Pull Requests

### Antes de Abrir um PR

- [ ] Branch atualizada com `main`
- [ ] Ciclo de qualidade passou (lint, typecheck, build, test)
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada (se aplicável)
- [ ] Commits seguem Conventional Commits
- [ ] Self-review do código

### Template de PR

```markdown
## Descrição
[Descrição clara das mudanças]

## Tipo de Mudança
- [ ] Bug fix (não quebra funcionalidade existente)
- [ ] Nova feature (não quebra funcionalidade existente)
- [ ] Breaking change (quebra funcionalidade existente)
- [ ] Documentação
- [ ] Refatoração

## Como Testar
1. [Passo 1]
2. [Passo 2]
3. [Resultado esperado]

## Checklist
- [ ] Meu código segue os padrões do projeto
- [ ] Fiz self-review do código
- [ ] Comentei código complexo quando necessário
- [ ] Atualizei a documentação
- [ ] Minhas mudanças não geram novos warnings
- [ ] Adicionei testes que provam que meu fix/feature funciona
- [ ] Testes novos e existentes passam localmente
- [ ] Verifiquei que não há conflitos

## Screenshots (se aplicável)
[Cole screenshots aqui]

## Issues Relacionadas
Closes #123
Relates to #456
```

### Tamanho do PR

- **Pequeno** (< 200 linhas): Ideal, revisão rápida
- **Médio** (200-500 linhas): Aceitável
- **Grande** (> 500 linhas): Considere dividir em PRs menores

**Dica:** PRs menores são revisados mais rapidamente e têm menor chance de bugs.

---

## Code Review

### Para Revisores

**O que verificar:**

- [ ] Código segue os padrões do projeto
- [ ] Lógica está correta e clara
- [ ] Não introduz vulnerabilidades de segurança
- [ ] Testes cobrem casos importantes
- [ ] Performance não foi prejudicada
- [ ] Documentação foi atualizada
- [ ] Commits seguem Conventional Commits

**Como revisar:**

1. **Teste localmente**: Clone a branch e execute
2. **Revise linha por linha**: Use GitHub review tools
3. **Seja construtivo**: Sugira melhorias, não apenas critique
4. **Aprove ou Solicite Mudanças**: Seja claro sobre o que precisa ser ajustado

### Para Autores

**Respondendo a reviews:**

- Agradeça os comentários
- Responda todas as observações
- Faça as mudanças solicitadas
- Re-solicite review após mudanças
- Não fique na defensiva - reviews melhoram o código

---

## Documentação

### O que Documentar

| Mudança                       | Documento a Atualizar         |
| ----------------------------- | ----------------------------- |
| Novo endpoint / alteração API | `docs/API.md`                 |
| Alteração de schema           | `docs/DATABASE.md`            |
| Mudança em auth/RBAC/sessão   | `docs/SECURITY.md`            |
| Nova feature / bug fix        | `docs/CHANGELOG.md`           |
| Mudança em deploy/infra       | `docs/DEPLOYMENT.md`          |
| Novo módulo                   | `docs/ARCHITECTURE.md`        |
| Módulo de loja                | `docs/MODULO_LOJA.md`         |

### Comentários no Código

**Quando comentar:**

```typescript
// ✅ BOM - Explica o "porquê"
// Usamos setTimeout aqui porque o toast precisa aparecer
// APÓS a animação de saída do modal (300ms)
setTimeout(() => {
  toast.success('Salvo com sucesso!');
}, 300);

// ❌ RUIM - Explica o "o quê" (óbvio do código)
// Incrementa o contador
counter++;
```

**Quando NÃO comentar:**

- Código auto-explicativo
- Nomes de variáveis/funções já deixam claro o propósito
- Usar refatoração ao invés de comentário explicativo

---

## Boas Práticas

### DRY (Don't Repeat Yourself)

```typescript
// ❌ RUIM - Código duplicado
function formatUserName(user: User) {
  return `${user.firstName} ${user.lastName}`;
}

function formatTeacherName(teacher: Teacher) {
  return `${teacher.firstName} ${teacher.lastName}`;
}

// ✅ BOM - Reutilização
function formatName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`;
}
```

### KISS (Keep It Simple, Stupid)

```typescript
// ❌ RUIM - Complexidade desnecessária
function isUserActive(user: User): boolean {
  return user.status === 'active' ? true : false;
}

// ✅ BOM - Simples e direto
function isUserActive(user: User): boolean {
  return user.status === 'active';
}
```

### Princípio da Responsabilidade Única

```typescript
// ❌ RUIM - Função faz muita coisa
function processUser(user: User) {
  validateUser(user);
  saveToDatabase(user);
  sendWelcomeEmail(user);
  logActivity(user);
}

// ✅ BOM - Cada função tem uma responsabilidade
function validateUser(user: User) { /* ... */ }
function saveUser(user: User) { /* ... */ }
function sendWelcomeEmail(user: User) { /* ... */ }
function logUserActivity(user: User) { /* ... */ }
```

---

## Processo de Aprovação

### Requisitos para Merge

- [ ] Aprovação de pelo menos 1 reviewer
- [ ] Todos os checks do CI passando
- [ ] Sem conflitos com `main`
- [ ] Documentação atualizada
- [ ] Changelog atualizado (se feature/fix significativo)

### Quem Pode Fazer Merge

- Mantenedores do projeto
- Colaboradores com permissão de write

---

## Dúvidas?

- **Issues**: [GitHub Issues](https://github.com/renatinhosfaria/portalessencia/issues)
- **Discussões**: [GitHub Discussions](https://github.com/renatinhosfaria/portalessencia/discussions)
- **Email**: admin@essencia.edu.br

---

## Agradecimentos

Obrigado por dedicar seu tempo para contribuir com o Portal Essência Feliz! 🎉

Cada contribuição, por menor que seja, torna o projeto melhor. Valorizamos muito seu esforço e dedicação.

---

<div align="center">

**Happy Coding!** 💻✨

</div>
