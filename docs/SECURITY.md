# Security Policy

Políticas e práticas de segurança do Portal Digital Colégio Essência Feliz.

---

## 🔐 Autenticação

### Sessões

| Configuração  | Valor                          |
| ------------- | ------------------------------ |
| **Storage**   | Redis                          |
| **TTL**       | 24 horas                       |
| **Renovação** | Sliding window (25%)           |
| **Cookie**    | HttpOnly, Secure, SameSite=Lax |

### Senhas

- **Algoritmo**: bcrypt
- **Salt Rounds**: 12
- **Requisitos mínimos**: 8 caracteres

---

## 🛡 Headers de Segurança

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

---

## 🔒 Infraestrutura

### Firewall (UFW)

```bash
# Portas permitidas
22  - SSH
80  - HTTP (redirect)
443 - HTTPS
```

### SSH

- ✅ Autenticação por chave
- ❌ Autenticação por senha
- ✅ Fail2Ban ativo

---

## 🚫 Rate Limiting

| Endpoint      | Limite           |
| ------------- | ---------------- |
| `/auth/login` | 5 req/min/IP     |
| `/auth/*`     | 30 req/min/IP    |
| `/*`          | 100 req/min/user |

---

## 📋 RBAC (Role-Based Access Control)

### Roles e Hierarquia

| Role                       | Nivel | Escopo  | Acesso                     |
| -------------------------- | ----- | ------- | -------------------------- |
| `master`                   | 0     | Global  | Total (todas as escolas)   |
| `diretora_geral`           | 1     | Escola  | Total (todas as unidades)  |
| `gerente_unidade`          | 2     | Unidade | Gestao completa da unidade |
| `gerente_financeiro`       | 3     | Unidade | Gestao financeira          |
| `coordenadora_geral`       | 4     | Unidade | Coordenacao academica      |
| `coordenadora_infantil`    | 5     | Unidade | Coordenacao infantil       |
| `coordenadora_fundamental` | 6     | Unidade | Coordenacao fundamental    |
| `analista_pedagogico`      | 7     | Unidade | Supervisao pedagogica      |
| `professora`               | 8     | Unidade | Turmas e alunos            |
| `auxiliar_administrativo`  | 9     | Unidade | Suporte administrativo     |
| `auxiliar_sala`            | 10    | Unidade | Suporte em sala            |

### Matriz de Permissoes

| Recurso        | master | diretora_geral | gerente_unidade | gerente_financeiro | coordenadora_geral | coordenadora_infantil | coordenadora_fundamental | analista_pedagogico | professora | auxiliar_administrativo | auxiliar_sala |
| -------------- | ------ | -------------- | --------------- | ------------------ | ------------------ | --------------------- | ------------------------ | ------------------- | ---------- | ----------------------- | ------------- |
| Schools (CRUD) | Total  | -              | -               | -                  | -                  | -                     | -                        | -                   | -          | -                       | -             |
| Units (CRUD)   | Total  | Total          | -               | -                  | -                  | -                     | -                        | -                   | -          | -                       | -             |
| Units (Read)   | Total  | Total          | Propria         | Propria            | Propria            | -                     | -                        | -                   | -          | -                       | -             |
| Users (CRUD)   | Total  | Total          | Propria         | Propria            | -                  | -                     | -                        | -                   | -          | -                       | -             |
| Users (Read)   | Total  | Total          | Propria         | Propria            | -                  | -                     | -                        | -                   | -          | -                       | -             |

---

## 🏢 Isolamento Multi-Tenant

### Estrutura de Tenant

```
Escola (tenant raiz)
  └── Unidades (sub-tenants)
        └── Usuarios (pertencem a uma unidade)
```

### Regras de Isolamento

1. **Escola**: Usuarios (exceto master) so podem acessar dados da sua propria escola
2. **Unidade**: Usuarios (exceto master e diretora_geral) so acessam dados da sua unidade
3. **Diretora Geral**: Tem acesso a todas as unidades da sua escola
4. **Cross-tenant**: Bloqueado pelo TenantGuard

### Implementacao

```typescript
// TenantGuard verifica:
if (user.role === "master") {
  return true;
}

if (resourceSchoolId !== user.schoolId) {
  throw new ForbiddenException("Escola diferente");
}

if (user.role !== "diretora_geral" && resourceUnitId !== user.unitId) {
  throw new ForbiddenException("Unidade diferente");
}
```

### Dados da Sessao (Redis)

```typescript
interface SessionData {
  userId: string;
  role: UserRole;
  schoolId: string; // Isolamento por escola
  unitId: string; // Isolamento por unidade
  createdAt: number;
}
```

---

## 🔍 Boas Práticas

### ✅ Fazer

- Validar todos os inputs (Zod)
- Usar prepared statements (Drizzle)
- Logs de auditoria
- HTTPS obrigatório
- Sessões com expiração automática

### ❌ Evitar

- Expor stack traces
- Armazenar senhas em texto
- Logs com dados sensíveis
- CORS permissivo

---

## 🐛 Vulnerabilidades

### Reportar

Email: security@essencia.edu.br

### Informações Necessárias

1. Descrição da vulnerabilidade
2. Passos para reproduzir
3. Impacto potencial
4. Sugestão de correção (opcional)

---

## 📦 Dependências

```bash
# Verificar vulnerabilidades
pnpm audit

# Atualizar
pnpm update
```

---

## 🔄 Backup

### Banco de Dados

```bash
# Backup diário automático
pg_dump -U essencia essencia_db > backup.sql
```

### Retenção

- Diário: 7 dias
- Semanal: 4 semanas
- Mensal: 12 meses

---

## 📝 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] SESSION_SECRET forte (32+ chars)
- [ ] HTTPS habilitado
- [ ] Firewall configurado
- [ ] Fail2Ban ativo
- [ ] Backups configurados
- [ ] Logs externalizados
