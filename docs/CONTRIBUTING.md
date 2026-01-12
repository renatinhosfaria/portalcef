# Guia de Contribuicao

Obrigado pelo interesse em contribuir com o Portal Digital Colegio Essencia Feliz!

---

## Indice

1. [Codigo de Conduta](#codigo-de-conduta)
2. [Como Contribuir](#como-contribuir)
3. [Setup de Desenvolvimento](#setup-de-desenvolvimento)
4. [Workflow de Desenvolvimento](#workflow-de-desenvolvimento)
5. [Padroes de Codigo](#padroes-de-codigo)
6. [Commits e Pull Requests](#commits-e-pull-requests)
7. [Testes](#testes)
8. [Documentacao](#documentacao)
9. [Review Process](#review-process)

---

## Codigo de Conduta

Este projeto segue um codigo de conduta que esperamos que todos os contribuidores respeitem:

- Seja respeitoso e inclusivo
- Aceite criticas construtivas
- Foque no que e melhor para a comunidade
- Demonstre empatia com outros membros

---

## Como Contribuir

### Reportar Bugs

1. Verifique se o bug ja foi reportado nas [Issues](https://github.com/renatinhosfaria/portalessencia/issues)
2. Se nao, crie uma nova issue com:
   - Titulo claro e descritivo
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Screenshots (se aplicavel)
   - Ambiente (OS, browser, versoes)

### Sugerir Features

1. Abra uma issue com a tag `enhancement`
2. Descreva o problema que a feature resolve
3. Proponha uma solucao
4. Discuta com a equipe antes de implementar

### Contribuir com Codigo

1. Fork o repositorio
2. Crie uma branch para sua feature
3. Implemente as mudancas
4. Escreva/atualize testes
5. Atualize documentacao
6. Abra um Pull Request

---

## Setup de Desenvolvimento

### Pre-requisitos

| Ferramenta     | Versao  |
| -------------- | ------- |
| Node.js        | >= 22.x |
| pnpm           | >= 9.x  |
| Docker         | >= 24.x |
| Docker Compose | >= 2.x  |
| Git            | >= 2.x  |

### Opcao 1: Desenvolvimento com Docker (Recomendado)

Ambiente totalmente containerizado com hot-reload:

```bash
# 1. Clone o repositorio
git clone https://github.com/renatinhosfaria/portalessencia.git
cd portalessencia

# 2. Inicie ambiente completo (todos os apps + API + DB)
pnpm docker:up

# 3. Execute migracoes
docker compose -f docker-compose.dev.yml exec dev pnpm db:migrate

# 4. Acesse os servicos
# Home:         http://localhost:3000
# Calendario:   http://localhost:3002
# Login:        http://localhost:3003
# Usuarios:     http://localhost:3004
# Escolas:      http://localhost:3005
# Turmas:       http://localhost:3006
# Planejamento: http://localhost:3007
# Loja:         http://localhost:3010
# Loja Admin:   http://localhost:3011
# API:          http://localhost:3001
```

**Nota:** O `docker-compose.dev.yml` atualmente expõe o Home na porta `3006`. Se preferir manter a porta `3000` do app `home`, ajuste o mapeamento de portas no compose.

**IMPORTANTE (Windows):** O projeto DEVE estar no filesystem WSL2 para performance aceitavel:

```bash
# No terminal WSL2
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/renatinhosfaria/portalessencia.git
```

Veja mais detalhes em [DEPLOYMENT.md](./DEPLOYMENT.md).

### Opcao 2: Desenvolvimento Hibrido (Tradicional)

Apenas infraestrutura em Docker, apps rodam localmente:

```bash
# 1. Clone o repositorio
git clone https://github.com/renatinhosfaria/portalessencia.git
cd portalessencia

# 2. Instale dependencias
pnpm install

# 3. Inicie servicos (PostgreSQL + Redis)
docker compose up -d

# 4. Execute migracoes
pnpm db:migrate

# 5. Inicie desenvolvimento
pnpm turbo dev
```

### Portas de Desenvolvimento

| Servico        | Porta | URL                   |
| -------------- | ----- | --------------------- |
| home           | 3000  | http://localhost:3000 |
| calendario     | 3002  | http://localhost:3002 |
| api            | 3001  | http://localhost:3001 |
| login          | 3003  | http://localhost:3003 |
| usuarios       | 3004  | http://localhost:3004 |
| escolas        | 3005  | http://localhost:3005 |
| turmas         | 3006  | http://localhost:3006 |
| planejamento   | 3007  | http://localhost:3007 |
| loja           | 3010  | http://localhost:3010 |
| loja-admin     | 3011  | http://localhost:3011 |
| PostgreSQL     | 5432  | localhost:5432        |
| Redis          | 6379  | localhost:6379        |
| Drizzle Studio | 4983  | http://localhost:4983 |

### Variaveis de Ambiente

```bash
# .env (desenvolvimento)
DATABASE_URL=postgresql://essencia:essencia_dev@localhost:5432/essencia_db
REDIS_URL=redis://localhost:6379
COOKIE_SECRET=dev-secret-change-in-production
```

---

## Workflow de Desenvolvimento

### 1. Criar Branch

```bash
# Features
git checkout -b feat/nome-da-feature

# Bug fixes
git checkout -b fix/descricao-do-bug

# Documentacao
git checkout -b docs/o-que-documenta
```

### 2. Desenvolver

```bash
# Rodar em watch mode
pnpm turbo dev

# Rodar apenas um app
pnpm turbo dev --filter=planejamento

# Rodar API isoladamente
pnpm turbo dev --filter=@essencia/api
```

### 3. Verificar Qualidade

**OBRIGATORIO antes de commit:**

```bash
# Executar em sequencia
pnpm turbo format      # Formatar codigo (Prettier)
pnpm turbo lint        # Verificar linting (ESLint)
pnpm turbo typecheck   # Verificar tipos (TypeScript)
pnpm turbo build       # Garantir build
pnpm turbo test        # Executar testes

# Ou todos de uma vez
pnpm turbo format && pnpm turbo lint && pnpm turbo typecheck && pnpm turbo build && pnpm turbo test
```

### 4. Commit e Push

```bash
git add .
git commit -m "feat(modulo): descricao da mudanca"
git push origin feat/nome-da-feature
```

---

## Padroes de Codigo

### Estrutura de Diretorios

```
apps/<modulo>/
  app/                 # Next.js App Router
    api/               # Route handlers (proxy para API)
    page.tsx           # Paginas
  components/          # Componentes locais
  features/            # Features do modulo
    <feature>/
      components/      # Componentes da feature
      hooks/           # Hooks da feature
      schemas.ts       # Validacao Zod
      actions.ts       # Server actions
      index.ts         # Exports

services/api/
  src/
    modules/<dominio>/
      <dominio>.module.ts
      <dominio>.controller.ts
      <dominio>.service.ts
      dto/

packages/
  ui/                  # Design System (shadcn)
  shared/              # Tipos, schemas, fetchers
  db/                  # Drizzle ORM
```

### Convencoes de Nomenclatura

| Item              | Convencao          | Exemplo             |
| ----------------- | ------------------ | ------------------- |
| Arquivos          | kebab-case         | `user-form.tsx`     |
| Componentes React | PascalCase         | `UserForm`          |
| Funcoes           | camelCase          | `getUserById`       |
| Constantes        | UPPER_SNAKE_CASE   | `MAX_RETRY_COUNT`   |
| Tipos/Interfaces  | PascalCase         | `UserSession`       |
| Schemas Zod       | camelCase + Schema | `createUserSchema`  |
| Dominio (negocio) | PT-BR              | `turma`, `quinzena` |

### TypeScript

```typescript
// Preferir tipos explicitos
function getUser(id: string): Promise<User | null> {
  // ...
}

// Usar interfaces para objetos de dominio
interface User {
  id: string;
  name: string;
  role: UserRole;
}

// Usar type para unions/intersections
type UserRole = "master" | "diretora_geral" | "professora";

// Sempre tipar retornos de funcao
const formatDate = (date: Date): string => {
  return date.toISOString();
};
```

### React

```tsx
// Componentes funcionais com tipagem
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({ children, onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// Exports nomeados (nao default)
export { Button };
```

### CSS/Styling

```tsx
// Usar Tailwind CSS
<div className="flex items-center gap-4 p-4">
  <span className="text-sm text-muted-foreground">Label</span>
</div>;

// Componentes shadcn para UI
import { Button } from "@essencia/ui/button";
import { Card } from "@essencia/ui/card";
```

---

## Commits e Pull Requests

### Conventional Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo>): <descricao>

[corpo opcional]

[rodape opcional]
```

**Tipos:**

| Tipo       | Descricao                          |
| ---------- | ---------------------------------- |
| `feat`     | Nova funcionalidade                |
| `fix`      | Correcao de bug                    |
| `docs`     | Apenas documentacao                |
| `style`    | Formatacao (sem mudanca de codigo) |
| `refactor` | Refatoracao (sem nova feature/fix) |
| `test`     | Adicao/correcao de testes          |
| `chore`    | Tarefas de manutencao              |

**Escopos:**

| Escopo         | Descricao               |
| -------------- | ----------------------- |
| `api`          | Backend NestJS          |
| `home`         | App home                |
| `login`        | App login               |
| `usuarios`     | App usuarios            |
| `escolas`      | App escolas             |
| `calendario`   | App calendario          |
| `turmas`       | App turmas              |
| `planejamento` | App planejamento        |
| `loja`         | App loja publica        |
| `loja-admin`   | App loja admin           |
| `shop`         | Modulo CEF Shop (API)   |
| `ui`           | Design System           |
| `db`           | Database/migrations     |
| `shared`       | Packages compartilhados |
| `deps`         | Dependencias            |
| `ci`           | CI/CD                   |

**Exemplos:**

```bash
feat(planejamento): add auto-save to wizard form
fix(api): handle null user in session validation
docs(readme): update installation instructions
refactor(auth): simplify guard logic
test(users): add unit tests for CRUD operations
chore(deps): update React to 19.x
```

### Pull Request

**Titulo:** Mesmo formato do commit principal

**Template:**

```markdown
## O que muda

[Descricao clara da mudanca]

## Por que

[Motivacao / problema resolvido]

## Como testar

1. [Passo 1]
2. [Passo 2]

## Checklist

- [ ] Testes adicionados/atualizados
- [ ] Documentacao atualizada
- [ ] `pnpm turbo typecheck` passando
- [ ] `pnpm turbo lint` passando
- [ ] `pnpm turbo build` passando
- [ ] `pnpm turbo test` passando

## Screenshots (se aplicavel)

[Imagens das mudancas de UI]
```

---

## Testes

### Estrutura

```
<arquivo>.ts         # Codigo fonte
<arquivo>.test.ts    # Testes
```

### Backend (Jest)

```typescript
// services/api/src/modules/users/users.service.spec.ts
describe("UsersService", () => {
  describe("findById", () => {
    it("should return user when found", async () => {
      // Arrange
      const userId = "test-id";

      // Act
      const result = await service.findById(userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
    });

    it("should return null when user not found", async () => {
      const result = await service.findById("non-existent");
      expect(result).toBeNull();
    });
  });
});
```

### Frontend (Vitest)

```typescript
// apps/planejamento/features/wizard/components/step-form.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepForm } from './step-form';

describe('StepForm', () => {
  it('should render form fields', () => {
    render(<StepForm />);
    expect(screen.getByLabelText(/turma/i)).toBeInTheDocument();
  });

  it('should show validation error on invalid input', async () => {
    render(<StepForm />);
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);
    expect(await screen.findByText(/campo obrigatorio/i)).toBeInTheDocument();
  });
});
```

### Comandos

```bash
# Todos os testes
pnpm turbo test

# Testes com cobertura
pnpm turbo test -- --coverage

# Watch mode
pnpm turbo test -- --watch

# Testes de um modulo
pnpm --filter @essencia/api test
pnpm --filter planejamento test
```

### Cobertura Minima

| Tipo               | Cobertura |
| ------------------ | --------- |
| Services (Backend) | 80%       |
| Controllers        | 70%       |
| Components (UI)    | 60%       |
| Utils/Helpers      | 90%       |

---

## Documentacao

### Quando Atualizar

| Mudanca                       | Documento                     |
| ----------------------------- | ----------------------------- |
| Novo endpoint / alteracao API | `docs/API.md`                 |
| Alteracao de schema           | `docs/DATABASE.md`            |
| Mudanca em auth/RBAC/sessao   | `docs/SECURITY.md`            |
| Nova feature / bug fix        | `docs/CHANGELOG.md`           |
| Mudanca em deploy/infra       | `docs/DEPLOYMENT.md`          |
| Novo modulo/arquitetura       | `docs/ARCHITECTURE.md`        |
| Modulo de loja                | `docs/MODULO_LOJA.md`         |

### Formato de Documentacao

- Markdown com formatacao consistente
- Tabelas para dados estruturados
- Blocos de codigo com syntax highlighting
- Exemplos praticos sempre que possivel

### Changelog

Seguimos [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- Nova funcionalidade X

### Changed

- Alteracao em Y

### Fixed

- Correcao de bug Z
```

---

## Review Process

### Checklist do Reviewer

1. **Codigo**
   - [ ] Segue padroes do projeto
   - [ ] Sem codigo duplicado
   - [ ] Nomes claros e descritivos
   - [ ] Complexidade aceitavel

2. **Seguranca**
   - [ ] Validacao de inputs
   - [ ] Guards aplicados corretamente
   - [ ] Sem exposicao de dados sensiveis
   - [ ] RBAC respeitado

3. **Testes**
   - [ ] Cobertura adequada
   - [ ] Casos de borda testados
   - [ ] Testes passando

4. **Documentacao**
   - [ ] Codigo auto-documentado
   - [ ] Docs atualizados se necessario
   - [ ] Changelog atualizado

### Timeline

- **Resposta inicial:** 24-48 horas
- **Review completo:** 3-5 dias uteis
- **Merge apos aprovacao:** mesmo dia

### Resolucao de Conflitos

1. Discutir na PR
2. Se nao houver consenso, escalar para tech lead
3. Decisao final documentada na PR

---

## Contato

- **Issues:** [GitHub Issues](https://github.com/renatinhosfaria/portalessencia/issues)
- **Email:** dev@essencia.edu.br

---

## Licenca

Este projeto e proprietario do Colegio Essencia Feliz. Contribuicoes sao bem-vindas mediante acordo.
