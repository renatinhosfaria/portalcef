# Database Documentation

Documentacao do banco de dados PostgreSQL e uso do Drizzle ORM no Portal Digital Colegio Essencia Feliz.

---

## Stack

| Tecnologia      | Versao | Uso                      |
| --------------- | ------ | ------------------------ |
| PostgreSQL      | 16     | Banco de dados principal |
| Drizzle ORM     | 0.38.2 | ORM type-safe            |
| Drizzle Kit     | 0.30.1 | Migrations/Studio        |
| Redis           | 7      | Cache e sessoes          |

---

## Visao Geral do Schema

Core (multi-tenant):
- `schools`, `units`, `education_stages`, `unit_stages`
- `users`, `sessions`
- `role_groups`, `role_group_mappings`
- `turmas`, `calendar_events`

Planejamento (Novo):
- `plano_aula_periodo` - Periodos configuraveis por etapa
- `plano_aula` - Planos de aula com periodos flexiveis
- `quinzena_documents` - Documentos anexados (DOCX→PDF)
- `plano_aula_historico` - Rastreamento de mudancas de status
- `plano_aula_comentarios` - Comentarios de revisao

Planejamento (Legacy):
- `plannings`, `planning_contents`, `planning_reviews`

Shop (CEF Shop):
- `shop_products`, `shop_product_images`, `shop_product_variants`
- `shop_inventory`, `shop_inventory_ledger`
- `shop_orders`, `shop_order_items`
- `shop_interest_requests`, `shop_interest_items`
- `shop_settings`

---

## Tabelas Principais (Core)

### schools

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `name` | text | Nome da escola |
| `code` | text | Codigo unico |
| `created_at` | timestamptz | Criacao |
| `updated_at` | timestamptz | Atualizacao |

### units

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `school_id` | uuid | FK -> schools.id |
| `name` | text | Nome |
| `code` | text | Codigo |
| `address` | text | Endereco (opcional) |
| `created_at` | timestamptz | Criacao |
| `updated_at` | timestamptz | Atualizacao |

### education_stages

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `code` | text | BERCARIO, INFANTIL, FUNDAMENTAL_I, FUNDAMENTAL_II, MEDIO |
| `name` | text | Nome da etapa |

### unit_stages

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `unit_id` | uuid | FK -> units.id |
| `stage_id` | uuid | FK -> education_stages.id |
| `is_active` | boolean | Soft delete |

### users

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `email` | text | UNIQUE |
| `password_hash` | text | Bcrypt |
| `name` | text | Nome |
| `role` | text | Enum de roles |
| `school_id` | uuid | FK -> schools.id |
| `unit_id` | uuid | FK -> units.id |
| `stage_id` | uuid | FK -> education_stages.id |
| `created_at` | timestamptz | Criacao |
| `updated_at` | timestamptz | Atualizacao |

### sessions

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `user_id` | uuid | FK -> users.id |
| `token` | text | UNIQUE |
| `expires_at` | timestamptz | Expiracao |
| `created_at` | timestamptz | Criacao |

### turmas

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `unit_id` | uuid | FK -> units.id |
| `stage_id` | uuid | FK -> education_stages.id |
| `professora_id` | uuid | FK -> users.id (opcional) |
| `name` | text | Nome da turma |
| `code` | text | Codigo unico por unidade/ano |
| `year` | integer | Ano letivo |
| `shift` | text | matutino/vespertino/integral |
| `capacity` | integer | Capacidade |
| `is_active` | boolean | Soft delete |

### calendar_events

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `unit_id` | uuid | FK -> units.id (obrigatorio) |
| `title` | text | Titulo |
| `description` | text | Descricao (opcional) |
| `event_type` | text | Enum (FERIADO, RECESSO, etc) |
| `start_date` | date | Inicio |
| `end_date` | date | Fim (obrigatorio) |
| `is_school_day` | boolean | Dia letivo |
| `is_recurring_annually` | boolean | Recorrente |
| `created_by` | uuid | FK -> users.id |
| `created_at` | timestamptz | Criacao |
| `updated_at` | timestamptz | Atualizacao |

---

## Planejamento Pedagogico

### plano_aula_periodo

**Armazena períodos configuráveis de planejamento de aulas por etapa educacional.**

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `unidade_id` | uuid | FK -> units.id (NOT NULL) |
| `etapa` | text | Etapa educacional (BERCARIO, INFANTIL, FUNDAMENTAL_I, FUNDAMENTAL_II, MEDIO) |
| `numero` | integer | Numero sequencial do periodo na etapa |
| `descricao` | text | Descricao opcional (ex: tema do periodo) |
| `data_inicio` | date | Data de inicio do periodo (NOT NULL) |
| `data_fim` | date | Data de fim do periodo (NOT NULL) |
| `data_maxima_entrega` | date | Prazo de entrega - deve ser antes do inicio (NOT NULL) |
| `criado_por` | uuid | FK -> users.id (usuario que criou o periodo) |
| `criado_em` | timestamptz | Criacao (DEFAULT NOW()) |
| `atualizado_em` | timestamptz | Atualizacao (DEFAULT NOW()) |

**Índices:**
- UNIQUE(unidade_id, etapa, numero) - Garante numeracao unica por etapa
- INDEX(unidade_id) - Buscas por unidade
- INDEX(etapa) - Filtro por etapa
- INDEX(data_inicio, data_fim) - Queries por periodo

**Constraints:**
- `data_inicio < data_fim`
- `data_maxima_entrega < data_inicio`
- Sem sobreposicao de datas na mesma unidade/etapa

**Relações:**
- `plano_aula.plano_aula_periodo_id` FK -> `plano_aula_periodo.id`

### plannings (Legacy)

**NOTA:** Sistema legado de quinzenas fixas. Em migração para `plano_aula_periodo`.

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `user_id` | uuid | FK -> users.id |
| `stage_id` | uuid | FK -> education_stages.id (opcional) |
| `turma_id` | text | Codigo da turma |
| `quinzena` | text | Ex: 2025-Q01 |
| `status` | text | Enum planning_status |
| `review_cycles` | integer | Ciclos de review |
| `first_pass_yield` | boolean | Aprovado sem ajustes |
| `created_at` | timestamptz | Criacao |
| `updated_at` | timestamptz | Atualizacao |
| `submitted_at` | timestamptz | Envio |
| `approved_at` | timestamptz | Aprovacao |

### planning_contents

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `planning_id` | uuid | FK -> plannings.id (UNIQUE) |
| `objetivos` | text | Texto |
| `metodologia` | text | Texto |
| `recursos` | text | Texto |
| `atividades` | text | Texto |
| `materia` | text | Texto |
| `tema` | text | Texto |
| `habilidades` | text | Texto |
| `conteudos` | text | Texto |
| `avaliacao` | text | Texto |
| `reforco` | text | Texto |
| `anexos` | jsonb | Array de anexos |

### planning_reviews

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `planning_id` | uuid | FK -> plannings.id |
| `reviewer_id` | uuid | FK -> users.id |
| `status` | text | Enum review_status |
| `comentario` | text | Obrigatorio |
| `created_at` | timestamptz | Criacao |

### plano_aula

**Sistema atual de planejamento com períodos configuráveis.**

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `professora_id` | uuid | FK -> users.id (professora titular) |
| `turma_id` | uuid | FK -> turmas.id |
| `plano_aula_periodo_id` | uuid | FK -> plano_aula_periodo.id |
| `status` | text | Enum: RASCUNHO, ENVIADO, EM_REVISAO, APROVADO, REJEITADO |
| `versao` | integer | Numero da versao (incrementa a cada submissao) |
| `criado_em` | timestamptz | Criacao |
| `atualizado_em` | timestamptz | Atualizacao |
| `enviado_em` | timestamptz | Data de envio |
| `aprovado_em` | timestamptz | Data de aprovacao |

**Índices:**
- INDEX(professora_id) - Planos por professora
- INDEX(turma_id) - Planos por turma
- INDEX(plano_aula_periodo_id) - Planos por periodo
- INDEX(status) - Filtro por status

**Relações:**
- `quinzena_documents.plano_aula_id` FK -> `plano_aula.id` (documentos anexados)
- `plano_aula_historico.plano_aula_id` FK -> `plano_aula.id` (historico de mudancas)
- `plano_aula_comentarios.plano_aula_id` FK -> `plano_aula.id` (comentarios de revisao)

### quinzena_documents

**Documentos anexados aos planos de aula.**

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `plano_aula_id` | uuid | FK -> plano_aula.id |
| `arquivo_original` | text | Nome do arquivo original |
| `caminho_pdf` | text | Caminho do PDF convertido |
| `tipo_mime` | text | Tipo MIME original |
| `tamanho` | integer | Tamanho em bytes |
| `uploaded_at` | timestamptz | Data de upload |

### plano_aula_historico

**Rastreamento de mudanças de status.**

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `plano_aula_id` | uuid | FK -> plano_aula.id |
| `status_anterior` | text | Status antes da mudanca |
| `status_novo` | text | Novo status |
| `usuario_id` | uuid | FK -> users.id (quem fez a mudanca) |
| `observacao` | text | Observacao opcional |
| `criado_em` | timestamptz | Quando a mudanca ocorreu |

### plano_aula_comentarios

**Comentários de revisão por coordenadoras.**

| Coluna | Tipo | Descricao |
| ------ | ---- | --------- |
| `id` | uuid | PK |
| `plano_aula_id` | uuid | FK -> plano_aula.id |
| `documento_id` | uuid | FK -> quinzena_documents.id (opcional - comentario em documento especifico) |
| `autor_id` | uuid | FK -> users.id (coordenadora) |
| `conteudo` | text | Texto do comentario |
| `criado_em` | timestamptz | Criacao |

---

## CEF Shop (Loja)

### shop_products

Campos principais: `school_id`, `name`, `description`, `image_url`, `base_price`, `category`, `is_active`.

### shop_product_images

Campos principais: `product_id`, `image_url`, `display_order`.

### shop_product_variants

Campos principais: `product_id`, `size`, `sku`, `price_override`, `is_active`.

### shop_inventory

Campos principais: `variant_id`, `unit_id`, `quantity`, `reserved_quantity`, `low_stock_threshold`.

### shop_inventory_ledger

Campos principais: `inventory_id`, `movement_type`, `quantity_change`, `reference_id`, `notes`, `created_by`, `created_at`.

### shop_orders

Campos principais: `school_id`, `unit_id`, `order_number`, `status`, `order_source`, `customer_*`, `total_amount`, `installments`, `payment_method`, `stripe_payment_intent_id`, `expires_at`, `paid_at`, `picked_up_at`, `cancelled_at`.

### shop_order_items

Campos principais: `order_id`, `variant_id`, `student_name`, `quantity`, `unit_price`.

### shop_interest_requests

Campos principais: `school_id`, `unit_id`, `customer_*`, `student_*`, `notes`, `contacted_at`, `contacted_by`.

### shop_interest_items

Campos principais: `interest_request_id`, `variant_id`, `quantity`.

### shop_settings

Campos principais: `unit_id`, `max_installments`, `is_shop_enabled`, `pickup_instructions`.

---

## Enums

### planning_status (Legacy)

`RASCUNHO`, `PENDENTE`, `EM_AJUSTE`, `APROVADO`

### review_status (Legacy)

`APROVADO`, `EM_AJUSTE`

### plano_aula_status

`RASCUNHO`, `ENVIADO`, `EM_REVISAO`, `APROVADO`, `REJEITADO`

**Fluxo:**
1. Professora cria plano → `RASCUNHO`
2. Professora envia → `ENVIADO`
3. Coordenadora inicia revisão → `EM_REVISAO`
4. Coordenadora aprova → `APROVADO`
5. Coordenadora rejeita → `REJEITADO` (professora pode reenviar)

### education_stage_enum

`BERCARIO`, `INFANTIL`, `FUNDAMENTAL_I`, `FUNDAMENTAL_II`, `MEDIO`

### shop enums

- `productCategoryEnum`: `UNIFORME_DIARIO`, `UNIFORME_EDUCACAO_FISICA`, `ACESSORIO`
- `orderStatusEnum`: `AGUARDANDO_PAGAMENTO`, `PAGO`, `RETIRADO`, `CANCELADO`, `EXPIRADO`
- `orderSourceEnum`: `ONLINE`, `PRESENCIAL`
- `paymentMethodEnum`: `PIX`, `CARTAO_CREDITO`, `CARTAO_DEBITO`, `DINHEIRO`
- `movementTypeEnum`: `ENTRADA`, `VENDA_ONLINE`, `VENDA_PRESENCIAL`, `AJUSTE`, `RESERVA`, `LIBERACAO`

---

## Drizzle ORM

### Estrutura de Arquivos

```
packages/db/src/schema/
  calendar-events.ts
  education-stages.ts
  planejamento.ts            # Legacy (plannings, planning_contents, planning_reviews)
  plano-aula.ts              # Novo sistema (plano_aula, plano_aula_periodo)
  quinzena-documents.ts      # Documentos anexados aos planos
  role-groups.ts
  schools.ts
  sessions.ts
  shop.ts
  shop-relations.ts
  turmas.ts
  turmas-relations.ts
  unit-stages.ts
  units.ts
  users.ts
```

### Comandos

```bash
pnpm db:generate   # gerar migracao
pnpm db:migrate    # aplicar migracoes
pnpm db:studio     # Drizzle Studio
```

---

## Doc Drift (Pendencias)

- `shop_interest_requests.status` e usado nos services do Shop, mas nao existe no schema atual (`packages/db/src/schema/shop.ts`). Necessita migration ou ajuste no service.

## Migração em Andamento

**Sistema de Planejamento (2026-01):**

Sistema **Legacy** (quinzenas fixas):
- `plannings`, `planning_contents`, `planning_reviews`
- Quinzenas hardcoded no código (Q01-Q24)
- Sem flexibilidade por etapa educacional

Sistema **Novo** (períodos configuráveis):
- `plano_aula_periodo` - Períodos configurados por coordenadora
- `plano_aula` - Planos vinculados a períodos flexíveis
- `quinzena_documents` - Upload e conversão DOCX→PDF via Carbone
- `plano_aula_historico` - Auditoria de mudanças
- `plano_aula_comentarios` - Feedback estruturado

**Status:**
- ✅ Migration 0012 aplicada em produção
- ✅ API `/plano-aula-periodos` implementada
- ✅ Interface da coordenadora implementada
- ⚠️ Interface da professora em desenvolvimento
- ⚠️ Sistema legado ainda em uso (coexistência temporária)

---

## Governanca

**`packages/db` so pode ser importado por `services/api`**.

```
App (Next.js) -> HTTP -> API (NestJS) -> Drizzle -> PostgreSQL
```
