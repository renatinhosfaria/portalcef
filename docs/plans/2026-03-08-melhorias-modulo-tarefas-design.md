# Design: Melhorias do Módulo de Tarefas

**Data:** 2026-03-08
**Status:** Aprovado
**Escopo:** 4 PRs independentes cobrindo 7 pendências identificadas na análise do módulo

---

## Contexto

Análise completa do módulo de tarefas identificou sete problemas. Este documento descreve o design aprovado para corrigi-los em quatro PRs temáticas independentes.

**Problemas endereçados:**
1. Seletor de responsável ausente (UUID manual)
2. Formulário `criar-form.tsx` duplica `tarefa-form.tsx`
3. Histórico de tarefas não gravado (tabela inexistente)
4. Filtros da UI incompletos em relação à API
5. Paginação ausente no frontend
6. Validação de contextos acoplada à role
7. Polling de 5 minutos para notificações

---

## PR 1 — UX Forms

### Objetivo
Substituir o campo UUID manual de responsável por autocomplete e eliminar a duplicata de formulário.

### Componente compartilhado `TarefaFormFields`

Extrair lógica comum para `features/criar-tarefa/components/tarefa-form-fields.tsx`. Recebe campos via props compatíveis com `react-hook-form`. Ambos `tarefa-form.tsx` (Sheet modal) e `criar-form.tsx` (página standalone) passam a usar este componente.

### Seletor de Responsável

**Backend:** adicionar suporte a query params no endpoint existente de usuários:
```
GET /api/usuarios?busca=nome&roles=coordenadora_*,analista_pedagogico,professora,auxiliar_*
```
Retorna `{ id: string, nome: string, role: string }[]`.

**Frontend:** novo hook `useUsuariosBusca({ roles })` com debounce de 300ms. O campo responsável vira `<Combobox>` (shadcn/ui) exibindo nome + role de cada resultado.

### Regras por role do criador

| Quem cria | Roles elegíveis para atribuição |
|---|---|
| `professora` | Somente si mesma (campo bloqueado e pré-preenchido) |
| `analista_pedagogico` | professora, auxiliar_*, analista_pedagogico |
| `coordenadora_*` | professora, auxiliar_*, analista_pedagogico, coordenadora_* |
| `gerente_unidade` / `diretora_geral` / `master` | Todas as roles |

O filtro de roles no frontend evita atribuições inválidas antes de chegar ao backend. A validação do backend permanece como está.

### Arquivos afetados
- `apps/tarefas/features/criar-tarefa/components/tarefa-form-fields.tsx` — novo
- `apps/tarefas/features/criar-tarefa/hooks/use-usuarios-busca.ts` — novo
- `apps/tarefas/app/criar/criar-form.tsx` — refatorado
- `apps/tarefas/app/tarefa-form.tsx` — refatorado
- `services/api/src/modules/usuarios/usuarios.controller.ts` — query params busca+roles

---

## PR 2 — Histórico + Timeline

### Objetivo
Gravar auditoria completa de todas as alterações em tarefas e exibi-la como timeline na tela de detalhe.

### Nova tabela `tarefa_historico`

```sql
CREATE TABLE "tarefa_historico" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tarefa_id"      UUID NOT NULL REFERENCES "tarefas"("id") ON DELETE CASCADE,
  "user_id"        UUID NOT NULL REFERENCES "users"("id"),
  "user_name"      TEXT NOT NULL,
  "user_role"      TEXT NOT NULL,
  "acao"           TEXT NOT NULL CHECK ("acao" IN (
                     'CRIADA', 'EDITADA', 'CONCLUIDA', 'CANCELADA'
                   )),
  "campo_alterado" TEXT,
  "valor_anterior" TEXT,
  "valor_novo"     TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_tarefa_historico_tarefa_id" ON "tarefa_historico"("tarefa_id");
CREATE INDEX "idx_tarefa_historico_created_at" ON "tarefa_historico"("created_at" DESC);
```

`user_name` e `user_role` são desnormalizados para preservar o estado no momento da ação (mesmo padrão de `plano_aula_historico`).

Para edições com múltiplos campos alterados, grava uma entrada por campo — mais granular para exibição na timeline.

### Ações e campos registrados

| Ação | `campo_alterado` | Contexto |
|---|---|---|
| `CRIADA` | — | `criarManual` e `criarAutomatica` |
| `EDITADA` | `titulo`, `descricao`, `prioridade`, `prazo`, `responsavel` | `atualizar` — uma entrada por campo |
| `CONCLUIDA` | — | `concluir` |
| `CANCELADA` | — | `cancelar` |

### Backend — `TarefaHistoricoService`

Novo service `tarefa-historico.service.ts` com método único:
```typescript
registrar(tx, { tarefaId, userId, userName, userRole, acao, campoAlterado?, valorAnterior?, valorNovo? })
```

Injetado no `TarefasService`. Chamado dentro das transações existentes após cada operação bem-sucedida. Nunca lança exceção — falha silenciosa em log para não interromper a operação principal.

Novo endpoint: `GET /api/tarefas/:id/historico` → `HistoricoEntry[]` ordenado por `created_at DESC`.

### Frontend — `TarefaHistoricoTimeline`

Novo componente `apps/tarefas/features/tarefa-detalhe/components/tarefa-historico-timeline.tsx`, seguindo o padrão visual do `HistoricoTimeline` do planejamento:

- Linha vertical conectando entradas
- Círculo com ícone colorido por ação:
  - `CRIADA` → `Plus` azul
  - `EDITADA` → `Edit` amarelo
  - `CONCLUIDA` → `CheckCheck` verde
  - `CANCELADA` → `X` vermelho
- Para `EDITADA`: exibe `campo → valor anterior → valor novo` formatado
- Timestamp relativo via `date-fns/formatDistanceToNow` com locale `ptBR`

Exibido em card abaixo das informações na tela `/tarefas/:id`.

Hook: `useHistoricoTarefa(tarefaId)` em `features/tarefa-detalhe/hooks/use-historico-tarefa.ts`.

### Arquivos afetados
- `packages/db/drizzle/XXXX_add_tarefa_historico.sql` — nova migration
- `packages/db/src/schema/tarefas.ts` — adicionar tabela e relações
- `services/api/src/modules/tarefas/tarefa-historico.service.ts` — novo
- `services/api/src/modules/tarefas/tarefas.service.ts` — injetar e chamar historico service
- `services/api/src/modules/tarefas/tarefas.controller.ts` — endpoint GET /:id/historico
- `apps/tarefas/features/tarefa-detalhe/hooks/use-historico-tarefa.ts` — novo
- `apps/tarefas/features/tarefa-detalhe/components/tarefa-historico-timeline.tsx` — novo
- `apps/tarefas/app/[id]/tarefa-detalhe-content.tsx` — incluir timeline

---

## PR 3 — Filtros Avançados & Paginação

### Objetivo
Expor na UI todos os filtros suportados pela API e implementar paginação com seletor de página.

### Painel de Filtros

Botão **"Filtros (N)"** com contador de filtros ativos ao lado dos tabs de tipo. Ao clicar, expande painel `<Collapsible>` (shadcn/ui) inline:

```
[Todas] [Minhas Tarefas] [Criadas por Mim]   [Filtros (2) ▼]
──────────────────────────────────────────────────────────────
Status: [Pendente ▼]    Prioridade: [Alta ▼]
Módulo: [Planejamento ▼]                    [Limpar filtros]
```

Filtros expostos:

| Filtro | Componente | Valores |
|---|---|---|
| `status` | `<Select>` | Pendente / Concluída / Cancelada |
| `prioridade` | `<Select>` | Alta / Média / Baixa |
| `modulo` | `<Select>` | Planejamento / Calendário / Usuários / Turmas / Loja |

`quinzenaId` omitido — técnico demais para o usuário final.

### Paginação

A API já retorna `{ data, pagination: { total, page, limit, totalPages } }`. O frontend passa a consumir esses dados.

**Comportamento:**
- 20 itens por página (padrão)
- Ao mudar qualquer filtro, reseta para `page = 1`
- Estado de filtros + página centralizado em `DashboardContent`

**Componente `TarefasPaginacao`:**
```
← Anterior   [1] [2] [3] ... [8]   Próximo →
             Mostrando 1–20 de 143 tarefas
```
- Exibe até 5 páginas visíveis com ellipsis
- Botões Anterior/Próximo desabilitados nos extremos

**O que não muda:**
- Stats cards refletem totais gerais (chamada separada para `/stats/resumo`)
- `TarefasPendentesWidget` nos outros apps usa hook próprio com limit fixo de 5

### Arquivos afetados
- `apps/tarefas/app/dashboard-content.tsx` — estado de filtros + paginação
- `apps/tarefas/features/tarefas-list/hooks/use-tarefas.ts` — page + limit
- `apps/tarefas/features/tarefas-list/components/tarefas-grid.tsx` — receber paginação
- `apps/tarefas/features/tarefas-list/components/tarefas-paginacao.tsx` — novo
- `apps/tarefas/features/tarefas-list/components/tarefas-filtros.tsx` — novo

---

## PR 4 — WebSocket para Notificações em Tempo Real

### Objetivo
Substituir o polling de 5 minutos por WebSocket bidirecional, eliminando latência nas notificações e abrindo infraestrutura para colaboração futura.

### Backend — `TarefasGateway`

Novo `services/api/src/modules/tarefas/tarefas.gateway.ts` usando `@nestjs/websockets` + `socket.io`:

**Namespace:** `ws://api/tarefas`

**Salas:**
- `escola:{schoolId}` — broadcast para toda a escola (futuro)
- `usuario:{userId}` — notificações individuais (uso atual)

**Autenticação no handshake:**
1. Extrai cookie de sessão do `client.handshake.headers.cookie`
2. Busca sessão no Redis via `SessionService` existente
3. Sessão inválida → `client.disconnect()`
4. Sessão válida → `client.join('usuario:' + userId)`

**Eventos emitidos pelo servidor:**

| Evento | Payload | Destinatário |
|---|---|---|
| `tarefa:criada` | `{ tarefaId, titulo, prioridade, prazo, responsavelId }` | `usuario:{responsavelId}` |
| `tarefa:atualizada` | `{ tarefaId, campos[] }` | `usuario:{responsavelId}` |
| `tarefa:concluida` | `{ tarefaId }` | `usuario:{responsavelId}` |
| `tarefa:cancelada` | `{ tarefaId }` | `usuario:{responsavelId}` |

O `TarefasGateway` é injetado no `TarefasService` e chamado após cada operação bem-sucedida.

### Frontend — `useTarefasSocket`

Novo hook `apps/tarefas/features/notificacoes/hooks/use-tarefas-socket.ts`:

```typescript
useTarefasSocket({
  onTarefaCriada: (payload) => { toast + refetch },
  onTarefaAtualizada: (payload) => { refetch silencioso },
  onTarefaConcluida: (payload) => { toast.success },
  onTarefaCancelada: (payload) => { refetch silencioso },
})
```

Usa `socket.io-client`. Gerencia reconexão automática (padrão socket.io).

**`TarefaNotificacaoProvider` atualizado:**
- Remove `setInterval` completamente
- Conecta via `useTarefasSocket` na montagem
- Emite `toast.error` para `tarefa:criada` com prazo passado ou prioridade `ALTA`
- Badge do sidebar exibe ponto verde (conectado) ou vermelho (desconectado)

### Dependências novas

| Pacote | Local |
|---|---|
| `@nestjs/websockets` | `services/api` |
| `@nestjs/platform-socket.io` | `services/api` |
| `socket.io` | `services/api` |
| `socket.io-client` | `apps/tarefas` |

### O que não muda
- Primeira carga via HTTP (`GET /api/tarefas`) — WS apenas para atualizações incrementais
- Outros apps (`planejamento`, `suporte`) não afetados
- Sem filas externas — emit síncrono dentro do processo NestJS

### Arquivos afetados
- `services/api/src/modules/tarefas/tarefas.gateway.ts` — novo
- `services/api/src/modules/tarefas/tarefas.module.ts` — registrar gateway
- `services/api/src/modules/tarefas/tarefas.service.ts` — injetar gateway
- `services/api/src/main.ts` — configurar socket.io adapter
- `apps/tarefas/features/notificacoes/hooks/use-tarefas-socket.ts` — novo
- `apps/tarefas/features/notificacoes/tarefa-notificacao-provider.tsx` — refatorar
- `apps/tarefas/features/widgets/tarefa-badge.tsx` — indicador de conexão
- `apps/tarefas/package.json` — adicionar socket.io-client

---

## Ordem de implementação recomendada

| Ordem | PR | Dependências |
|---|---|---|
| 1 | PR 1 — UX Forms | Nenhuma |
| 2 | PR 2 — Histórico | Nenhuma |
| 3 | PR 3 — Filtros & Paginação | Nenhuma |
| 4 | PR 4 — WebSocket | Última (mais invasiva) |

PRs 1, 2 e 3 podem ser desenvolvidas em paralelo. PR 4 deve ser mergeada por último.
