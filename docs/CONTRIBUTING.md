# Contributing Guide

Guia para contribuidores do Portal Digital Colégio Essência Feliz.

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/renatinhosfaria/portalessencia.git
cd portalessencia

# Setup
pnpm install
cp .env.example .env
docker compose up -d

# Dev
pnpm dev
```

---

## 📋 Pré-requisitos

- Node.js >= 22.0.0
- pnpm >= 9.0.0
- Docker + Docker Compose
- Git

---

## 🌿 Branches

| Branch      | Uso                 |
| ----------- | ------------------- |
| `main`      | Produção            |
| `develop`   | Desenvolvimento     |
| `feature/*` | Nova funcionalidade |
| `fix/*`     | Correção de bug     |
| `hotfix/*`  | Correção urgente    |

---

## 📝 Commits

### Conventional Commits

```
<type>(<scope>): <description>

feat(auth): add password reset
fix(api): handle null user
docs(readme): update installation
```

### Types

| Type       | Descrição           |
| ---------- | ------------------- |
| `feat`     | Nova funcionalidade |
| `fix`      | Correção de bug     |
| `docs`     | Documentação        |
| `style`    | Formatação          |
| `refactor` | Refatoração         |
| `test`     | Testes              |
| `chore`    | Manutenção          |

---

## 🔄 Pull Requests

### Checklist

- [ ] Código segue style guide
- [ ] Testes passando
- [ ] Documentação atualizada
- [ ] Sem conflitos

### Template

```markdown
## Descrição

Breve descrição das mudanças

## Tipo

- [ ] Feature
- [ ] Fix
- [ ] Docs

## Testes

Descreva os testes realizados
```

---

## 🧪 Testes

```bash
pnpm test           # Todos os testes
pnpm lint           # Linting
pnpm typecheck      # TypeScript
```

---

## 📁 Estrutura

```
apps/                  # Next.js apps
  ├── home/            # Portal público (3000)
  ├── login/           # Autenticação (3003)
  ├── escolas/         # Gestão de escolas (3005)
  └── usuarios/        # Gestão de usuários (3004)
services/              # Backend
  └── api/             # NestJS API (3001)
packages/              # Código compartilhado
  ├── ui/              # Design System (shadcn/ui)
  ├── db/              # Drizzle ORM
  ├── shared/          # Tipos, Schemas, Fetchers
  ├── config/          # ESLint, TSConfig
  └── tailwind-config/ # Preset Tailwind
```

---

## 💻 Code Style

- **TypeScript** strict mode
- **ESLint** + Prettier
- **Imports** ordenados
- **Naming** camelCase/PascalCase

```bash
pnpm format    # Auto-format
pnpm lint      # Check issues
```

---

## 📚 Documentação

- Atualizar docs ao modificar APIs
- Comentar código complexo
- Manter CHANGELOG.md atualizado

---

## ❓ Dúvidas

- Issues: GitHub
- Email: dev@essencia.edu.br
