# Correções do Módulo Usuários — Plano de Implementação

> **Para o Codex:** executar este plano tarefa a tarefa seguindo TDD.

**Objetivo:** corrigir os fluxos de erro, inativação, atribuição e apresentação de dados do módulo de usuários, mantendo contratos HTTP e UI coerentes.

**Arquitetura:** o controller delegará falhas para exceções NestJS com status HTTP correto; o serviço aplicará filtros de domínio no banco; a UI usará o fetcher compartilhado e atualizará a rota sem recarregar o documento inteiro. Os testes de serviço/controller cobrirão os contratos que hoje não existem.

**Stack:** NestJS, Drizzle, Jest, Next.js App Router, React, Vitest, Zod.

---

### Tarefa 1: Invariantes de inativação e atribuição

**Arquivos:**

- Modificar: `services/api/src/modules/users/users.service.ts`
- Testar: `services/api/src/modules/users/users.service.spec.ts`

1. Escrever testes para ignorar turmas inativas ao inativar professora e para excluir usuários inativos da busca de atribuição.
2. Rodar os testes e confirmar falha.
3. Adicionar `isActive = true` na consulta de turmas e `inativadoEm IS NULL` na busca.
4. Rodar a suíte de usuários e confirmar aprovação.

### Tarefa 2: Contrato HTTP de inexistência

**Arquivos:**

- Modificar: `services/api/src/modules/users/users.controller.ts`
- Criar: `services/api/src/modules/users/users.controller.spec.ts`

1. Escrever teste de controller para `GET /users/:id` inexistente.
2. Confirmar falha com o retorno atual.
3. Lançar `NotFoundException` antes do enriquecimento.
4. Rodar os testes de controller e serviço.

### Tarefa 3: Tratamento de erros e atualização da UI

**Arquivos:**

- Modificar: `services/api/src/common/filters/api-exception.filter.ts`
- Modificar: `packages/components/src/users-page-content.tsx`
- Modificar: `apps/usuarios/app/page.tsx`
- Modificar: `packages/components/src/user-list.tsx`
- Modificar: `packages/lib/src/types.ts`

1. Escrever testes de contrato para `details.turmas` e para o mapeamento de inativação.
2. Confirmar falha.
3. Preservar detalhes adicionais no filtro e usar `api`/`FetchError` na UI.
4. Trocar reload completo por `router.refresh`, exibir erro de carregamento e renomear “Último Acesso” para “Inativado em”.
5. Rodar testes, lint e typecheck.

### Tarefa 4: Formulário e cobertura mínima

**Arquivos:**

- Modificar: `packages/components/src/user-form.tsx`
- Criar/modificar: testes de componentes do módulo
- Modificar: `docs/API.md`

1. Escrever teste para não carregar opções enquanto o formulário estiver fechado.
2. Confirmar falha.
3. Tornar carregamento de escolas, unidades e etapas lazy na abertura.
4. Documentar endpoints de busca, inativação, reativação e `inativos`.
5. Rodar pipeline direcionado e global.
