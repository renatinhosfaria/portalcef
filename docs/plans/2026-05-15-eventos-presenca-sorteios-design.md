# Design: Presença e Sorteios do Módulo Eventos

**Data:** 2026-05-15
**Status:** Aprovado
**Escopo:** Confirmar presença das inscritas no evento e sortear brindes usando o Nº Inscrição, impedindo que a mesma pessoa ganhe mais de uma vez.

---

## Contexto

O módulo `eventos` já possui uma lista administrativa de inscritas para o evento "Mãe por Inteiro", publicada em `apps/eventos/app/inscricoes-evento/page.tsx`. Cada inscrição tem um `numero_inscricao` amigável no formato `XXX-XXX`, único por evento, persistido em `evento_inscricoes`.

No dia do evento, a escola precisa marcar quem realmente compareceu e usar apenas essas pessoas confirmadas para o sorteio de brindes. O sorteio deve ser feito por brinde, registrando o histórico e garantindo que uma mesma inscrita não seja sorteada novamente no mesmo evento.

## Decisões Aprovadas

### Presença

A confirmação de presença será manual na lista atual de inscritas.

- A equipe busca a inscrita por nome, CPF, email, telefone ou Nº Inscrição.
- Cada linha da tabela terá uma coluna **Presença**.
- A ação principal será **Confirmar presença**.
- Para corrigir erro operacional, a mesma tela permitirá **Desfazer presença**.
- A tela terá contador de **Presentes confirmadas** e filtro **Somente presentes**.
- As exportações CSV/XLSX incluirão presença e data/hora da confirmação.

### Sorteio

O sorteio será feito por brinde.

- A equipe informa o nome do brinde.
- O sistema sorteia apenas entre inscritas com presença confirmada.
- Quem já ganhou qualquer brinde no mesmo evento fica inelegível para novos sorteios.
- O resultado será persistido com brinde, inscrição, Nº Inscrição, horário e usuário responsável.
- A tela exibirá o último resultado em destaque e um histórico dos brindes sorteados.

## Alternativas Consideradas

### Presença persistida + tabela de sorteios

Opção aprovada. Mantém histórico, permite auditoria e protege a regra de negócio no backend e no banco.

### Sorteio somente no frontend

Descartado. Seria rápido de montar, mas perderia histórico ao recarregar a página e ficaria vulnerável a clique duplo, concorrência e resultados divergentes entre computadores.

### Tela pública com animação para telão

Adiada. Pode ser útil depois, mas aumenta o escopo sem ser necessária para credenciamento, sorteio e auditoria.

## Modelo de Dados

### Alteração em `evento_inscricoes`

Adicionar campos de presença:

```sql
ALTER TABLE "evento_inscricoes"
  ADD COLUMN IF NOT EXISTS "presenca_confirmada_em" timestamptz,
  ADD COLUMN IF NOT EXISTS "presenca_confirmada_por" uuid;
```

`presenca_confirmada_em` define se a inscrita está presente. `presenca_confirmada_por` registra o usuário que fez a confirmação. Ao desfazer presença, os dois campos são limpos.

### Nova tabela `evento_sorteios`

```sql
CREATE TABLE IF NOT EXISTS "evento_sorteios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "evento_slug" varchar(80) NOT NULL,
  "brinde" varchar(200) NOT NULL,
  "inscricao_id" uuid NOT NULL REFERENCES "evento_inscricoes"("id") ON DELETE RESTRICT,
  "numero_inscricao" varchar(7) NOT NULL,
  "sorteado_em" timestamptz NOT NULL DEFAULT now(),
  "sorteado_por" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_evento_sorteios_evento_inscricao"
  ON "evento_sorteios" ("evento_slug", "inscricao_id");

CREATE INDEX IF NOT EXISTS "idx_evento_sorteios_evento_slug"
  ON "evento_sorteios" ("evento_slug");

CREATE INDEX IF NOT EXISTS "idx_evento_sorteios_sorteado_em"
  ON "evento_sorteios" ("sorteado_em" DESC);
```

O índice único `evento_slug + inscricao_id` é a garantia final de que a mesma pessoa não ganha mais de uma vez no mesmo evento, inclusive com duas pessoas clicando em sortear ao mesmo tempo.

## API

Os endpoints serão autenticados e usarão as mesmas roles já permitidas na lista de inscritas: `master`, `diretora_geral`, `gerente_unidade` e `auxiliar_administrativo`.

### Confirmar ou desfazer presença

```http
PATCH /api/eventos/:slug/inscricoes/:id/presenca
Content-Type: application/json

{ "presente": true }
```

Com `presente: true`, grava presença e usuário responsável. Com `presente: false`, desfaz a confirmação. A resposta retorna a inscrição atualizada.

### Listar sorteios

```http
GET /api/eventos/:slug/sorteios
```

Retorna o histórico ordenado por `sorteado_em DESC`, com brinde, Nº Inscrição, nome, telefone, email e horário.

### Sortear brinde

```http
POST /api/eventos/:slug/sorteios
Content-Type: application/json

{ "brinde": "Cesta de café da manhã" }
```

O backend valida que o brinde não está vazio. Em transação, seleciona uma inscrição presente que ainda não aparece em `evento_sorteios`, grava o resultado e retorna os dados da ganhadora.

Se não houver inscritas elegíveis, a API responde com mensagem clara: "Não há inscritas presentes elegíveis para sorteio."

## Fluxo de Dados

1. A equipe abre a lista de inscritas em `/eventos/inscricoes-evento`.
2. A busca permite localizar por Nº Inscrição, nome, CPF, email ou telefone.
3. Ao clicar em **Confirmar presença**, a UI chama o endpoint de presença e atualiza a linha.
4. O contador de presentes e o filtro **Somente presentes** usam os dados retornados pela listagem.
5. No painel de sorteio, a equipe informa o brinde e clica em **Sortear entre presentes**.
6. A API escolhe uma inscrita elegível, persiste o sorteio e retorna o resultado.
7. A UI mostra o resultado em destaque e atualiza o histórico de sorteios.

## Regras de Negócio

- Somente inscrições do mesmo `evento_slug` participam do sorteio.
- Somente inscritas com `presenca_confirmada_em` preenchido são elegíveis.
- Uma inscrição que já exista em `evento_sorteios` para o mesmo evento não é elegível.
- O Nº Inscrição continua sendo a referência principal exibida para a equipe e para o anúncio do resultado.
- O frontend não decide quem pode ganhar; a regra fica no service da API e no índice único do banco.
- Desfazer presença de uma pessoa já sorteada não apaga o histórico do sorteio.

## Tratamento de Erros e Concorrência

- Brinde vazio: retornar `400 Bad Request` com validação em Português.
- Inscrição inexistente ou de outro evento: retornar `404 Not Found`.
- Usuário sem permissão: manter `401/403` conforme guards atuais.
- Sem elegíveis: retornar erro controlado, sem criar sorteio.
- Clique duplo ou sorteio concorrente: o índice único impede duplicidade. O service pode tentar novamente algumas vezes quando houver colisão; se não conseguir, retorna erro pedindo novo sorteio.

## Interface

### Lista de Inscritas

Adicionar:

- coluna **Presença**;
- botão **Confirmar presença**;
- ação **Desfazer presença** para correção;
- filtro **Somente presentes**;
- contador **Presentes confirmadas**;
- busca incluindo `numeroInscricao`;
- exportação com colunas "Presença" e "Confirmada em".

### Painel de Sorteio

Adicionar um bloco **Sorteio de brindes** na mesma página:

- campo **Nome do brinde**;
- botão **Sortear entre presentes**;
- contador **Elegíveis para sorteio**;
- card do último resultado com Nº Inscrição, nome e telefone;
- histórico com brinde, Nº Inscrição, ganhadora, telefone e horário.

## Testes

### API

- Confirma presença de uma inscrição do evento.
- Desfaz presença e limpa os campos de auditoria.
- Inclui Nº Inscrição na busca de inscrições.
- Sorteia apenas entre inscrições presentes.
- Não sorteia inscrição sem presença confirmada.
- Não sorteia novamente uma inscrição que já ganhou outro brinde.
- Retorna erro quando não há elegíveis.
- Retorna erro para brinde vazio.
- Preserva a regra mesmo com tentativa de duplicidade.

### Frontend

- Exibe controles de presença na lista.
- Permite filtro de presentes.
- Exibe painel de sorteio por brinde.
- Exibe histórico de sorteios.
- Mantém o módulo eventos fora de `loja-admin`.

## Arquivos Prováveis

- `packages/db/src/schema/evento-inscricoes.ts`
- `packages/db/drizzle/XXXX_eventos_presenca_sorteios.sql`
- `services/api/src/modules/evento-inscricoes/evento-inscricoes.controller.ts`
- `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts`
- `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.ts`
- `apps/eventos/app/inscricoes-evento/page.tsx`
- `apps/loja-admin/__tests__/modulo-eventos.test.ts`

## Fora de Escopo

- QR Code para check-in.
- Tela pública ou animação para telão.
- Envio automático de resultado por WhatsApp ou email.
- Cadastro prévio de todos os brindes antes do evento.
