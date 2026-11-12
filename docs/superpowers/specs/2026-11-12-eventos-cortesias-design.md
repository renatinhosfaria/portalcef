# Ingressos de cortesia com assento marcado — Design

**Data:** 2026-11-12
**Status:** desenho aprovado pelo Renato em conversa em 2026-11-12; aguardando revisão desta spec
**Contexto:** pedido da escola para emitir ingressos sem custo, com o assento escolhido previamente pela própria escola.

## Intenção

A escola precisa reservar lugares para convidados (professores, homenageados, famílias, autoridades) sem cobrar por eles. Pelo painel administrativo, a secretaria escolhe a sessão, marca vários assentos de uma vez e emite as cortesias. Cada assento vira um voucher próprio, idêntico ao de quem comprou, que a escola baixa em PDF e envia por conta própria.

Sucesso é: a escola consegue separar uma fileira inteira em poucos cliques, antes ou durante a venda; o convidado entra com o QR code como qualquer comprador; e nenhum assento de cortesia pode ser vendido ao público por engano.

## Decisões tomadas com o Renato

| Tema | Decisão |
|------|---------|
| Volume | Emissão em lote: vários assentos por vez. |
| Voucher | Um voucher por assento, igual ao de um comprador. O lote é só a forma de emitir. |
| Nomes | Nome do grupo obrigatório. Nome por assento opcional; na falta, vale o nome do grupo. |
| Entrega | A escola baixa o PDF no painel e envia. O sistema não envia nada. |
| Cancelamento | Permitido, por voucher, com motivo. O assento volta a ficar livre. |
| Momento | A qualquer momento em que a sessão tenha mapa confirmado e inventário, inclusive com o evento em rascunho. |
| Modelo de dados | Abordagem A: cada cortesia é um pedido confirmado de valor zero. |

Suposições minhas, não contestadas: os perfis que emitem e cancelam são os de `EVENTOS_ADMIN_ROLES`; não há limite de cortesias por evento; o tipo exibido no voucher é "Cortesia".

## Estado atual que a mudança toca

- `eventoOperacoesAdministrativas` já tem o tipo `CORTESIA`, mas nenhum serviço grava nessa tabela. `trava-venda.ts` e `levar-sessoes.ts` já tratam operação `ATIVA` como impedimento para trocar o mapa.
- `eventoIngressos` exige `orderId`, `itemId` e `participantId`. O único ponto que emite ingresso é `EventosPagamentosService.confirmarCheckout`, depois de um pagamento aprovado.
- `eventoItensPedido.ticketTypeId` é obrigatório, então a cortesia precisa de um tipo de ingresso.
- O token do QR code é montado pelo método privado `token()` de `EventosPagamentosService`, usando `EVENTOS_QR_SECRET`.
- O PDF é gerado no navegador por `apps/eventos/lib/pdf-ingresso.ts`, a partir de `PedidoComIngressos`.
- As rotas públicas de pedido e de mapa (`pedidoResult`, `getPublicMap`) respondem 404 se o evento não estiver `PUBLICADO`. Por isso o painel não pode depender delas.
- O mapa é desenhado por `MapaEstiloB`, em `@essencia/components/eventos/mapa-estilo-b`, já compartilhado entre os apps.
- No painel, `apps/eventos-admin/app/eventos/[id]/inventario` só lista assentos, e `InventoryGrid` tem botões "bloquear / cortesia / reservar" que não estão ligados a nada.
- Um assento é considerado livre quando o inventário está `DISPONIVEL` ou `LIBERADO` e sem `reservedByOrderId`.

## Pré-requisito

Há alterações sem commit na `main` em `apps/eventos/lib/pdf-ingresso.ts`, `apps/eventos/components/ingressos/acoes-ingresso.tsx` e nos testes deles (trabalho de compartilhamento por WhatsApp). Esta spec move o gerador de PDF de lugar. Aquele trabalho deve estar concluído e commitado antes de a implementação começar.

## Objetivos

- Emitir de 1 a 50 cortesias por operação, em uma única sessão, com assentos escolhidos no mapa.
- Garantir que o lote seja atômico: ou todas as cortesias são emitidas, ou nenhuma.
- Produzir ingressos indistinguíveis dos comprados para o voucher, o PDF e o check-in.
- Permitir cancelar uma cortesia e devolver o assento ao estoque.
- Registrar quem emitiu, quem cancelou, quando e por quê.
- Manter o tipo "Cortesia" invisível para a venda pública e para a configuração do evento.

## Fora do escopo

- Cancelar um lote inteiro em uma ação.
- Trocar o assento de uma cortesia emitida (cancela-se e emite-se outra).
- Envio automático por e-mail ou WhatsApp.
- Limite ou cota de cortesias por evento.
- Ligar os botões "bloquear" e "reservar" do `InventoryGrid`. Os três botões mortos saem do componente; bloqueio e reserva ficam para outra spec.
- As telas de Pedidos e Check-in do painel, que continuam como estão.

## Modelo de dados

Uma migration nova, só com colunas aditivas:

- `evento_tipos_ingresso.internal boolean not null default false`. Marca tipos de uso interno, que não entram na venda.
- `evento_pedidos.origin text not null default 'VENDA'`, com os valores `VENDA` e `CORTESIA`.

Mudanças apenas em TypeScript (as colunas são `text`): `eventoAuditoriaAcaoEnum` ganha `CORTESIA_EMITIDA` e `CORTESIA_CANCELADA`.

### O que uma cortesia grava

Para cada assento do lote:

| Tabela | Conteúdo |
|--------|----------|
| `evento_pedidos` | `status = CONFIRMADO`, `origin = CORTESIA`, `totalCents = subtotalCents = discountCents = 0`, `buyerName` = nome do grupo, `buyerEmail` e `buyerPhone` = contato do grupo (opcionais), `confirmedAt` = agora, `expiresAt = null`, `idempotencyKey = cortesia:<chave do lote>:<inventorySeatId>`. |
| `evento_participantes` | `type = CONVIDADO`, `fullName` = nome do assento ou, se vazio, nome do grupo. |
| `evento_itens_pedido` | Tipo "Cortesia" do evento, `unitPriceCents = totalPriceCents = 0`, `pricingEvidence = { origem: "CORTESIA" }`. |
| `evento_inventario_assentos` | `status = VENDIDO`, `soldAt` = agora. |
| `evento_ingressos` | `status = EMITIDO`, número e token assinado gerados como na venda. |
| `evento_operacoes_administrativas` | `type = CORTESIA`, `status = ATIVA`, `orderId`, `participantId`, `reason` = motivo informado, `createdBy` = usuário da sessão. |
| `evento_auditorias` | Uma linha por lote: `action = CORTESIA_EMITIDA`, `resourceType = "cortesia"`, `actorId`, `actorRole`, `sessionId`, `reason`, `metadata = { grupo, quantidade, orderNumbers }`. |

Não há linha em `evento_pagamentos`, `evento_reservas` nem `evento_aceites`.

### Tipo de ingresso "Cortesia"

Criado sob demanda na primeira emissão do evento: `name = "Cortesia"`, `priceCents = 0`, `internal = true`, `active = true`. As emissões seguintes reutilizam o mesmo registro.

Toda consulta que hoje filtra `active = true` para venda ou configuração passa a exigir também `internal = false`: listagem e detalhe públicos, validação do tipo na reserva pública, listagem e edição de tipos no painel (`listarIngressos`, `salvarIngressos`, `removerIngresso`), `EventosRulesService` e `EventosReadinessService`. Sem isso, `salvarIngressos` desativaria o tipo interno por não encontrá-lo no payload da tela.

## API

Novo `EventosCortesiasService` e novo `EventosCortesiasController` em `services/api/src/modules/eventos/`, registrados em `eventos.module.ts`. O controller segue o padrão de `MapasController`: `@Controller("eventos/admin/:id")`, `@UseGuards(AuthGuard, RolesGuard)`, `@ExactRoles()` e `@Roles(...EVENTOS_ADMIN_ROLES)`. O isolamento por escola é feito no serviço, como no restante do módulo: toda rota carrega o evento e confere que ele pertence à escola do usuário da sessão (`assertSchoolScope`), nunca a um valor vindo do payload.

| Rota | Função |
|------|--------|
| `GET cortesias` | Lista as cortesias do evento. |
| `GET sessoes/:sessionId/mapa-admin` | Mapa da sessão com o estado de cada assento, sem exigir evento publicado. |
| `POST cortesias` | Emite um lote. |
| `GET cortesias/:orderId/voucher` | Dados do voucher no formato `PedidoComIngressos`. |
| `POST cortesias/:orderId/cancelar` | Cancela uma cortesia. |

### Refatorações que acompanham

- O método `token()` sai de `EventosPagamentosService` para um arquivo próprio, `token-ingresso.ts`, usado pelos dois serviços.
- A montagem do mapa (assentos, rotação, estado) sai de `EventosService.getPublicMap` para uma função reutilizada pelas versões pública e administrativa. A pública mantém as exigências de publicação; a administrativa exige apenas mapa `CONFIRMADO` e escopo da escola.
- A montagem de `PedidoComIngressos` a partir de um pedido sai de `obterIngressos` para uma função reutilizada pela rota do voucher administrativo.

### Emitir lote: `POST cortesias`

Entrada, validada com Zod em `@essencia/shared`:

```ts
{
  sessionId: string;            // uuid
  chave: string;                // idempotência, gerada pela tela
  grupo: string;                // 2 a 200 caracteres
  motivo: string;               // 3 a 500 caracteres
  contatoEmail?: string;
  contatoTelefone?: string;
  assentos: Array<{ inventorySeatId: string; nome?: string }>;  // 1 a 50, sem repetição
}
```

Dentro de uma única transação:

1. Carrega evento e sessão. A sessão precisa pertencer ao evento, ter mapa `CONFIRMADO` e não estar cancelada. O evento não pode estar `CANCELADO`. Rascunho e pausado são aceitos.
2. Se já existir pedido com `idempotencyKey` iniciando em `cortesia:<chave>:`, devolve o resultado da emissão anterior sem gravar nada.
3. Trava as linhas de inventário pedidas com `FOR UPDATE`, em ordem de `id`, para não cruzar travas com a venda pública.
4. Verifica cada assento: precisa ser da sessão informada e estar livre. Se algum falhar, a transação é desfeita e a resposta é `409 ASSENTOS_INDISPONIVEIS` com a lista `{ inventorySeatId, rowLabel, seatNumber, motivo }` de todos os que falharam.
5. Obtém ou cria o tipo "Cortesia".
6. Grava, por assento, as linhas descritas em "O que uma cortesia grava". A mudança do inventário é condicional ao estado livre; se não afetar linha, a transação é desfeita com o mesmo 409.
7. Grava a auditoria do lote.

Resposta: a lista das cortesias emitidas, no mesmo formato da listagem.

### Cancelar: `POST cortesias/:orderId/cancelar`

Entrada: `{ motivo: string }`, de 3 a 500 caracteres. Em uma transação:

1. Carrega o pedido com trava. Precisa ser do evento e ter `origin = CORTESIA`; caso contrário, 404.
2. Se o pedido já estiver `CANCELADO`, responde sucesso sem alterar nada.
3. Se o ingresso estiver `USADO`, responde `409 CORTESIA_JA_UTILIZADA`.
4. Atualiza: ingresso para `CANCELADO` com `revokedAt`; pedido para `CANCELADO` com `cancelledAt` e `cancellationReason`; operação para `CANCELADA` com `cancelledAt`; inventário para `DISPONIVEL`, com `soldAt = null`.
5. Grava auditoria `CORTESIA_CANCELADA` com autor e motivo.

### Listar: `GET cortesias`

Devolve, por cortesia: `orderId`, `orderNumber`, sessão (`id`, `startsAt`), `rowLabel`, `seatNumber`, `participantName`, `grupo`, `motivo`, `numero` do ingresso, `situacao` (`ATIVA`, `USADA` ou `CANCELADA`), `emitidaPor` (nome), `emitidaEm`, `canceladaEm`. Ordenada da mais recente para a mais antiga. Filtro e busca acontecem na tela; o volume por evento é pequeno.

## PDF compartilhado

`gerarPdfIngressos`, `nomeArquivoIngresso` e `compartilharOuBaixar` saem de `apps/eventos/lib/pdf-ingresso.ts` para `packages/components/src/eventos/pdf-ingresso.ts`, exportado como `@essencia/components/eventos/pdf-ingresso`. `jspdf` e `qrcode` passam a ser dependências de `@essencia/components`. O formatador de data que o gerador usa vai para `@essencia/shared/eventos`.

A função que carrega a arte do evento hoje monta a URL com `window.location.origin` e `/_next/image`, o que pressupõe o site público. Ela passa a ser um parâmetro obrigatório: o site público entrega a sua versão atual; o painel entrega uma versão com o seu próprio `basePath`. Se a arte falhar, o ingresso sai sem ela, como hoje.

Os testes do gerador se mudam com ele. O site público passa a importar do pacote, sem mudança de comportamento.

## Tela: aba "Cortesias"

Nova rota `apps/eventos-admin/app/eventos/[id]/cortesias/page.tsx` e novo item "Cortesias" na navegação do workspace, depois de "Inventário", sem estado de prontidão (não bloqueia a publicação). O código da feature fica em `apps/eventos-admin/features/eventos/cortesias/`:

| Arquivo | Responsabilidade |
|---------|------------------|
| `api-cortesias.ts` | Chamadas às cinco rotas, pelo proxy `/eventos-admin/api/eventos/admin/...`. |
| `use-emissao-cortesias.ts` | Estado da emissão: sessão, seleção, nomes, envio, conflitos. |
| `emitir-cortesias.tsx` | Seletor de sessão, mapa e painel do lote. |
| `painel-lote.tsx` | Assentos marcados, campos do grupo e botão de emitir. |
| `lista-cortesias.tsx` | Tabela das emitidas, filtro, busca, baixar PDF e cancelar. |
| `dialogo-cancelar.tsx` | Confirmação do cancelamento com motivo. |

### Emitir

1. Seletor de sessão. Sessão sem mapa confirmado aparece desabilitada, com o texto "Confirme o mapa desta sessão para emitir cortesias".
2. Mapa com `MapaEstiloB`. Assento livre é clicável e alterna a seleção. Assento vendido, reservado ou bloqueado aparece em cinza e não é clicável. Ao atingir 50 selecionados, novos cliques são ignorados e aparece o aviso do limite.
3. Painel do lote ao lado do mapa (abaixo, em tela estreita): cada assento marcado com rótulo "Fileira X · Assento N", campo opcional de nome e botão de remover; depois, nome do grupo, motivo, e-mail e telefone opcionais.
4. Botão "Emitir N cortesias", desabilitado sem assento, grupo ou motivo. Abre confirmação com o resumo antes de enviar.

A chave de idempotência é gerada quando a seleção começa e renovada depois de uma emissão bem-sucedida.

Em caso de `ASSENTOS_INDISPONIVEIS`: a seleção é mantida, os assentos em conflito ficam destacados no mapa e no painel, o mapa é recarregado e a mensagem diz quais lugares deixaram de estar livres. Em caso de sucesso: a seleção é limpa, o mapa e a lista são recarregados e aparece a confirmação com a quantidade emitida.

### Cortesias emitidas

Tabela com sessão, assento, nome, grupo, número do ingresso, emitida por, data e situação. Filtro por sessão e busca por grupo ou nome. Em cada linha:

- **Baixar PDF**: busca o voucher, gera o PDF com o gerador compartilhado e baixa o arquivo. Indisponível para cortesia cancelada.
- **Cancelar**: abre o diálogo com motivo obrigatório. Indisponível para cortesia usada ou já cancelada.

Estados de carregamento, lista vazia ("Nenhuma cortesia emitida neste evento") e erro de rede seguem o padrão das outras abas.

## Efeitos no restante do sistema

- **Venda pública:** o assento de cortesia fica `VENDIDO`, então aparece como ocupado e não pode ser reservado. A reserva pública não muda.
- **Financeiro:** sem linha em `evento_pagamentos`, a cortesia não entra em nenhum total de receita. `origin` permite separar os pedidos em telas e relatórios futuros.
- **Troca de mapa:** `trava-venda.ts` já bloqueia com ingresso emitido ou operação ativa. Passa a valer assim que houver a primeira cortesia, mesmo em rascunho. Cancelar todas as cortesias libera a troca.
- **Exclusão de sessão:** já é impedida quando há inventário, operações ou ingressos.
- **Expiração de reservas:** o job parte das linhas de `evento_reservas`. A cortesia não cria reserva, então nunca é alcançada por ele.
- **"Meus ingressos":** se a escola informar e-mail de contato, o convidado encontra o voucher pelo site depois que o evento for publicado. Efeito aceito.
- **Check-in futuro:** o ingresso de cortesia tem o mesmo formato de token; nenhuma regra especial.

## Erros

| Código | HTTP | Quando |
|--------|------|--------|
| `EVENT_NOT_FOUND` | 404 | Evento inexistente ou de outra escola. |
| `SESSION_NOT_FOUND` | 404 | Sessão inexistente ou de outro evento. |
| `MAP_NOT_CONFIRMED` | 409 | Sessão sem mapa confirmado. |
| `EVENTO_CANCELADO` | 409 | Emissão em evento cancelado. |
| `ASSENTOS_INDISPONIVEIS` | 409 | Um ou mais assentos não estão livres; traz a lista. |
| `CORTESIA_NOT_FOUND` | 404 | Pedido inexistente, de outro evento ou que não é cortesia. |
| `CORTESIA_JA_UTILIZADA` | 409 | Cancelamento de ingresso já usado. |
| `EVENTOS_QR_SECRET_MISSING` | 500 | Segredo do QR ausente; nada é gravado. |

Payload inválido responde 400 com os erros do Zod.

## Testes

Escritos antes do código, com falha confirmada antes da implementação.

**API, `eventos-cortesias.service.spec.ts`**
- Emite N cortesias: N pedidos confirmados de valor zero com `origin = CORTESIA`, N ingressos, N operações ativas, inventário `VENDIDO`, uma auditoria.
- Usa o nome do assento quando informado e o nome do grupo quando não.
- Cria o tipo "Cortesia" na primeira emissão e o reutiliza na segunda.
- Recusa o lote inteiro e lista os conflitos quando um assento está vendido, reservado, bloqueado ou é de outra sessão.
- Repetir a mesma `chave` não duplica e devolve o mesmo resultado.
- Emite com evento em rascunho; recusa com evento cancelado e com mapa não confirmado.
- Recusa evento de outra escola.
- Cancela: ingresso `CANCELADO`, pedido `CANCELADO`, operação `CANCELADA`, inventário `DISPONIVEL`, auditoria gravada.
- Cancelar duas vezes é inofensivo; cancelar ingresso usado é recusado; cancelar pedido de venda responde 404.
- O voucher administrativo devolve `PedidoComIngressos` com evento não publicado.

**API, regressão**
- Tipo interno não aparece na listagem pública, no detalhe público, na listagem do painel nem na prontidão, e não pode ser usado na reserva pública.
- `salvarIngressos` não desativa o tipo interno.
- Os testes existentes de pagamento continuam passando depois da extração do token.

**Controller**
- Rotas exigem os perfis de `EVENTOS_ADMIN_ROLES` e passam o usuário da sessão ao serviço.

**Painel**
- `use-emissao-cortesias`: alternar seleção, limite de 50, botão desabilitado sem grupo ou motivo, conflito mantém a seleção e marca os assentos, sucesso limpa e renova a chave.
- `lista-cortesias`: filtro, busca, ações desabilitadas conforme a situação, cancelamento exige motivo.
- A navegação do workspace inclui "Cortesias".

**PDF**
- Os testes do gerador passam no novo pacote; o site público continua gerando o mesmo arquivo.

**Verificação final:** `pnpm turbo lint && pnpm turbo typecheck`, mais os testes de `services/api`, `apps/eventos-admin`, `apps/eventos`, `packages/components` e `packages/shared`.

## Deploy

Há migration nova, então o deploy usa `./scripts/deploy.sh --migrar`. As duas colunas têm valor padrão e não exigem ajuste de dados. A emissão depende de `EVENTOS_QR_SECRET`, a mesma variável que a venda já usa para assinar ingressos; não há variável nova.
