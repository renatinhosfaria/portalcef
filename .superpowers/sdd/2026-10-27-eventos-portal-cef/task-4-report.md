# Task 4 — Administração protegida no Portal CEF

Implementada a área administrativa multi-evento sob o Shell existente, preservando `apps/eventos/app/inscricoes-evento`.

## Arquivos principais

- Dashboard e lista: `apps/eventos/app/page.tsx`, `apps/eventos/app/eventos/page.tsx`.
- Criação: `apps/eventos/app/eventos/novo/page.tsx`, `features/eventos/evento-form.tsx`.
- Detalhes: páginas de mapa, sessões, inventário, pedidos, check-in e configurações.
- Componentes: `map-review.tsx`, `session-editor.tsx`, `inventory-grid.tsx`.
- Proxy protegido: `app/api/eventos/admin/[...path]/route.ts`, usando `proxyRequest` e cookies.
- Testes: `app/page.test.ts`, `evento-form.test.ts`, `map-review.test.ts`.

## Checks

- `pnpm --filter eventos test` — passou (6 testes).
- `pnpm --filter eventos typecheck` — passou.
- `pnpm --filter eventos build` — compilação concluída; Next exibiu apenas aviso de múltiplos lockfiles e warning de import order no teste.

## Limitações

A listagem e criação usam a rota proxy administrativa, mas as operações de pedidos, check-in e configurações permanecem estados vazios até as APIs das Tasks 6/7. O inventário recebe dados da API quando integrado e não mantém reserva otimista local.

## Round 1

Corrigido o uso do `basePath` nas chamadas públicas, incluído `schoolId`, controles de sessões múltiplas, ingressos e cinco políticas, revisão de mapa com upload privado e resolução de conflitos, e ações de inventário com motivo obrigatório e tratamento de rejeição. Testes: 7 passaram; typecheck passou; build concluído com avisos de lockfiles/import order.

## Round 2

Proxy preserva prefixo `/api`, uploads multipart encaminham bytes, tenant define `schoolId` sem permitir override do formulário, e páginas de mapa/inventário usam rotas públicas com estados de erro. Testes e typecheck passaram.

## Round 3

Mapa agora inicia por upload e propaga `mapId/importId` às rotas de revisão, detecção e confirmação. Inventário apenas consulta o endpoint GET disponível e mantém ações sem mutação otimista enquanto operações aguardam Task 7. Testes e typecheck passaram.

## Round 4

Revisão de mapa agora interpreta `detections`, sincroniza propostas após upload, edita a proposta selecionada e envia payload com `seats` e motivo. O formulário remove flags de herança do DTO e converte exceções para IDs/null. Testes e typecheck passaram.

## Round 5

Adicionados campos de resumo, telefone, publicação planejada, categoria e imagem; exceções de local/mapa por sessão; inventário achata linhas `{session, inventory}` com loading/erro e IDs compostos. Testes e typecheck passaram.

## Round 6

Removidos `any` do inventário, normalizados status da API para a união da UI e achatadas linhas `{session, inventory}`. Campos opcionais vazios são enviados como `null` para o DTO. Testes e typecheck passaram.

## Round 7

Falhas de importação, correção e confirmação de mapa agora aparecem na tela. Pedidos, check-in e configurações exibem contexto operacional pendente e link de retorno. Testes/typecheck passaram.

## Round 8

Páginas de pedidos, check-in e configurações agora exibem títulos específicos, o ID do evento e link de retorno ao detalhe. Testes e typecheck passaram.

## Round 9

Detecções da API são adaptadas dos campos `proposed*` para o modelo de revisão. Ações de inventário exigem callback explícito e a página informa pendência da Task 7. DTO de formulário separado do estado visual de sessões.

## Round 10

Revisão exibe confiança, aguarda correção antes de limpar conflito, status desconhecido do inventário vira bloqueado e respostas `{success:false}` da criação exibem erro mesmo com HTTP 2xx. Testes/typecheck passaram.

## Round 11

Adicionados helpers puros de adaptação de detecções e flatten/normalização de inventário com testes Vitest runtime. Eventos: 9 testes passaram e typecheck passou.
