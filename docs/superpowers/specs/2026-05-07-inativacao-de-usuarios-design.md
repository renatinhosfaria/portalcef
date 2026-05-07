# Inativação de Usuários

**Data:** 2026-05-07
**Status:** Design aprovado, aguardando implementação
**Autor:** Renato Faria (com brainstorming assistido)

---

## Contexto e Problema

Hoje a tabela `users` no Portal Essência Feliz não tem nenhum campo de status. Qualquer usuário registrado consegue fazer login enquanto souber a senha — não há mecanismo para desativar uma conta sem deletá-la. Isso é especialmente problemático para professoras que saem da escola (caso real: Karla Rívia continua com acesso após sair em fevereiro/2026), pois delete é destrutivo (cascata em planos via `ON DELETE CASCADE`) e perde histórico pedagógico.

A solução é introduzir **inativação reversível** com auditoria temporal — soft-delete via timestamp.

## Decisões de Comportamento

Decisões tomadas durante brainstorming:

1. **Modelagem temporal.** Coluna `inativado_em TIMESTAMPTZ NULL` (NULL = ativo) ao invés de `is_active boolean`. Preserva quando a inativação aconteceu sem precisar de tabela de histórico. Adicionalmente, coluna `inativado_por UUID NULL` para auditoria de quem fez.

2. **Bloqueio com vínculos ativos.** Se a usuária a ser inativada é `professora` e ainda é titular de pelo menos uma turma, a operação é rejeitada com mensagem orientativa. Isso força a coordenadora a usar o fluxo já existente de troca/remoção de titular antes de inativar — o que aciona automaticamente a transferência de planos pendentes (feature de 2026-05-07).

3. **Não toca em planos pendentes diretamente.** Por consequência da regra anterior, a inativação por si só não modifica `plano_aula`. O fluxo correto é: (re)atribuir nova professora à turma → `transferirPlanosPendentes` move os planos → inativar a antiga.

4. **Login bloqueia inativos.** Após validar email/senha, se `inativado_em IS NOT NULL`, retorna 401 com a mensagem genérica "Email ou senha inválidos". Não vaza o status da conta.

5. **Sessões ativas são revogadas na inativação.** Reaproveita `SessionService.deleteAllUserSessions(userId)` que já existe no projeto (eficiente via Redis Set `user_sessions:<id>`).

6. **Reativação simétrica.** Setar `inativado_em = NULL` e `inativado_por = NULL` reativa a conta. Mesmas roles autorizadas que inativam.

7. **Listagem default = só ativos.** `GET /api/users` filtra `inativado_em IS NULL` por padrão. Query string `?inativos=true` inclui inativos para revisão administrativa.

## Mudanças no Schema

### `users`

Duas colunas novas:

```typescript
inativadoEm: timestamp("inativado_em", { withTimezone: true }),
inativadoPor: uuid("inativado_por").references(() => users.id, {
  onDelete: "set null",
}),
```

`inativado_por` referencia `users.id` com `ON DELETE SET NULL` — se quem inativou for por sua vez deletado, perdemos o registro do ator mas mantemos o `inativado_em` (a inativação em si não some).

Arquivo afetado: `packages/db/src/schema/users.ts`.

### Migration manual

Padrão dos commits anteriores (migration manual quando há semântica fora do que `db:generate` cobre bem).

```sql
ALTER TABLE "users" ADD COLUMN "inativado_em" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN "inativado_por" UUID REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX "users_inativado_em_idx" ON "users" ("inativado_em") WHERE "inativado_em" IS NOT NULL;
```

Índice parcial em `inativado_em IS NOT NULL` é otimização para listagens "ver inativos" — pequeno mas focado, sem indexar todos os registros ativos.

## Endpoints

### `PUT /api/users/:id/inativar`

Roles: `master`, `diretora_geral`, `gerente_unidade`, `gerente_financeiro`.

Validações no service (na ordem):

1. **Auto-inativação:** `params.id !== ator.userId` — senão `403 Forbidden` "Você não pode inativar a si mesmo".
2. **Hierarquia:** ator pode gerenciar a role do alvo (`canManageRole` existente em `@essencia/shared/roles`) — senão `403`.
3. **Já inativo:** se `target.inativadoEm !== null`, retorna `409 Conflict` "Usuário já está inativo desde DD/MM/YYYY".
4. **Vínculos ativos (apenas se role do alvo = `professora`):** `SELECT id, name, code FROM turmas WHERE professoraId = :id` — se houver, retorna `422 Unprocessable Entity` com payload:
   ```json
   {
     "code": "USUARIO_TEM_VINCULOS_ATIVOS",
     "message": "Não é possível inativar: a professora é titular das turmas listadas. Atribua outra professora ou remova a titularidade antes.",
     "turmas": [{ "id": "...", "name": "1° Ano A", "code": "1A" }]
   }
   ```
5. **Aplicar:** `UPDATE users SET inativado_em = NOW(), inativado_por = :ator.userId WHERE id = :id`.
6. **Revogar sessões:** `await sessionService.deleteAllUserSessions(targetId)`.

Resposta de sucesso: `200 OK` com o usuário atualizado (sem `passwordHash`).

### `PUT /api/users/:id/reativar`

Mesmas roles. Validações:

1. **Auto-reativação:** `params.id !== ator.userId` (não há fluxo prático onde alguém se reativa — proteção defensiva).
2. **Hierarquia.**
3. **Já ativo:** se `target.inativadoEm === null`, retorna `409 Conflict`.
4. **Aplicar:** `UPDATE users SET inativado_em = NULL, inativado_por = NULL WHERE id = :id`.

Não há revalidação de turmas/vínculos — reativar é seguro por construção. **Reativar NÃO restaura sessões antigas** (já foram revogadas no momento da inativação) — a usuária precisa fazer login novamente do zero.

### `GET /api/users` (alteração)

Aceita query string `inativos=true|false`. Default `false` (apenas ativos).

```sql
WHERE (inativado_em IS NULL OR :incluir_inativos = true)
```

## Mudança no AuthService

`AuthService.login` (`services/api/src/modules/auth/auth.service.ts`) ganha checagem após validação de senha:

```typescript
if (user.inativadoEm !== null) {
  throw new UnauthorizedException("Email ou senha inválidos");
}
```

Mensagem **idêntica** à de senha errada — não diferencia "conta não existe" de "senha errada" de "conta inativa". Defesa em profundidade contra enumeração de contas.

## Mudança na UI (`apps/usuarios`)

Não está em escopo bloqueante para a entrega da API — pode ser entregue em PR separado se preferir. O design da UI:

### Listagem

- Toggle "Mostrar inativos" no header (default off)
- Quando off: chama `/api/users` sem query string
- Quando on: chama `/api/users?inativos=true`
- Linha de usuário inativo: texto em cinza, badge "Inativo desde DD/MM/YYYY"
- Coluna "Ações" tem botão "Inativar" (ativos) ou "Reativar" (inativos)

### Modal de confirmação

Inativar: "Tem certeza? <Nome> não conseguirá mais fazer login até ser reativada. Sessões ativas serão encerradas imediatamente."

Reativar: "Tem certeza? <Nome> poderá fazer login novamente."

### Erro de vínculos (422)

Modal especial mostrando as turmas vinculadas e link "Ir para gestão de turmas".

## Tipos compartilhados

`packages/shared/src/types/user.ts` (criar se não existir, ou achar o tipo `User` exportado e estender):

```typescript
export interface User {
  // ... campos existentes
  inativadoEm: string | null;  // ISO 8601 quando serializado
  inativadoPor: string | null; // UUID
}
```

`drizzle-zod` em `packages/db/src/schema/users.ts` deriva schemas automaticamente — basta os campos existirem na tabela. Garantir que `passwordHash` continua excluído nas respostas (já é prática atual via `Omit<User, "passwordHash">`).

## Testes

### Unit (`UsersService.inativar`)

- ✅ Inativa usuário válido → seta `inativadoEm` e `inativadoPor`, chama `deleteAllUserSessions`
- ✅ Auto-inativação → `ForbiddenException`
- ✅ Hierarquia inválida (ator não pode gerenciar role do alvo) → `ForbiddenException`
- ✅ Alvo já inativo → `ConflictException`
- ✅ Professora com turma vinculada → `UnprocessableEntityException` com payload `turmas`
- ✅ Professora SEM turma vinculada → inativa normalmente
- ✅ Não-professora (coordenadora, analista) → não consulta turmas, inativa direto

### Unit (`UsersService.reativar`)

- ✅ Reativa usuário inativo → limpa timestamp e ator
- ✅ Auto-reativação → `ForbiddenException`
- ✅ Hierarquia inválida → `ForbiddenException`
- ✅ Alvo já ativo → `ConflictException`

### Unit (`AuthService.login`)

- ✅ Login com `inativadoEm = null` → sucesso
- ✅ Login com `inativadoEm` setado → `UnauthorizedException` com mesma mensagem de senha errada

### Unit (`UsersService.findAllByTenant` ou equivalente)

- ✅ Default exclui inativos
- ✅ `incluirInativos=true` retorna ambos

## Outras Listagens de Usuários

Existem queries em outros módulos que listam usuários para seleção (ex: `TurmasService.findAvailableProfessoras`). Essas devem **filtrar inativos por padrão** — uma professora inativa não deve aparecer como opção para atribuir a uma turma. Auditar e ajustar:

- `TurmasService.findAvailableProfessoras` (`services/api/src/modules/turmas/turmas.service.ts:336`) — adicionar `WHERE users.inativadoEm IS NULL`
- Outros endpoints que listam usuários para seleção em UI (planejamento, suporte, eventos, etc.) — verificar caso a caso

Listagens administrativas explícitas (`/api/users` com `inativos=true`) continuam podendo retornar inativos. Listagens funcionais ("escolha uma professora") não.

## Decisões Não-Tomadas (por design)

- **Tabela `users_inativacao_historico`** com múltiplas inativações/reativações ao longo do tempo. Out of scope. Se um dia precisar, adiciona depois.
- **Notificação para usuário inativado** (email avisando). Out of scope.
- **Inativação automática por inatividade prolongada** (ex: sem login há 6 meses). Out of scope.
- **UI integrada** — listada como complementar, pode ser PR separado.

## Arquivos Afetados

- `packages/db/src/schema/users.ts` — duas colunas novas + tipo
- `packages/db/drizzle/<NOVA>.sql` — migration manual + entrada no `_journal.json`
- `packages/db/drizzle/meta/_journal.json` — registrar migration nova
- `packages/shared/src/types/user.ts` (ou onde User está tipado) — campos `inativadoEm`, `inativadoPor`
- `services/api/src/modules/users/users.service.ts` — métodos `inativar`, `reativar`, ajuste em `findAllByTenant`
- `services/api/src/modules/users/users.service.spec.ts` — novos testes
- `services/api/src/modules/users/users.controller.ts` — endpoints `/inativar`, `/reativar`, query `?inativos=`
- `services/api/src/modules/auth/auth.service.ts` — check `inativadoEm` no login
- `services/api/src/modules/auth/auth.service.spec.ts` — caso de login inativo (se houver suite)
- `apps/usuarios/...` — UI (escopo separado opcional)
