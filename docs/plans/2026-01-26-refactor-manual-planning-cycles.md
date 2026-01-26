# Refatoração do Módulo de Planejamento: Ciclos Manuais

## 1. Visão Geral
Substituição da lógica de "Quinzenas Automáticas" por "Ciclos de Planejamento Gerenciados". 
O sistema deixa de calcular datas baseadas em números de semanas/anos e passa a obedecer entidades de configuração criadas explicitamente pela gestão escolar.

## 2. Mudanças de Banco de Dados

### 2.1 Nova Tabela: `planning_templates` (Configurações dos Ciclos)
Armazena a definição do ciclo (ex: "1º Plano de Aula") para uma determinada escola e etapa.

```sql
CREATE TABLE "planning_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL, -- Cada escola tem seu calendário
  "stage" text NOT NULL,     -- Enum: BERCARIO, INFANTIL, FUNDAMENTAL_I...
  "name" text NOT NULL,      -- Ex: "1º Plano de Aula"
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "submission_deadline" timestamp NOT NULL, -- Prazo para professores
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "deleted_at" timestamp -- Soft delete para histórico
);

-- Index para busca rápida por escola/etapa
CREATE INDEX "idx_planning_templates_school_stage" ON "planning_templates" ("school_id", "stage");
```

### 2.2 Migração de Dados
- Como estamos "começando do zero" em termos de lógica (fresh start para o novo modelo), a tabela começará vazia.
- Os planos de aula existentes (se houverem e precisarem ser mantidos) precisariam ser vinculados a um template "Legacy". Dado o contexto de "delete all" anterior, assumimos que novos planos serão criados do zero vinculados a esses novos templates.

## 3. Backend (API)

### 3.1 Novos Endpoints (Gestão)
- `GET /api/planning-templates?schoolId=...`
  - Retorna lista agrupada por etapa.
- `POST /api/planning-templates`
  - Payload: `{ schoolId, stage, name, startDate, endDate, submissionDeadline }`
- `PUT /api/planning-templates/:id`
- `DELETE /api/planning-templates/:id`

### 3.2 Alteração na Lógica de Listagem (Professora)
- Atual: `PlanningService.getQuinzenaAtual()` -> Lógica matemática de datas.
- Novo: `PlanningService.getAvailableTemplates(schoolId, stage)`
  - Busca templates ativos no banco.
  - Cruza com a tabela `planos_aula` para saber se a professora já iniciou aquele plano.

## 4. Frontend

### 4.1 Nova Tela: `/planejamento/gestao`
- **Público**: Diretora, Gerente, Coordenadoras.
- **Layout**: 
  - Tabs por Etapa (Infantil, Fundamental, etc).
  - Listagem de cards/tabela com os ciclos cadastrados.
  - Botão "Novo Ciclo de Planejamento".
- **Formulário**:
  - Modal com campos de Data Início, Fim e Prazo de Entrega.
  - Validação garantindo consistência de datas.

### 4.2 Alteração no Dashboard da Professora
- Remover seletor de "Ano/Quinzena".
- Exibir Grid de Cards baseados nos `planning_templates` existentes.
- Status Visual:
  - "Não Iniciado" (Botão: Criar Plano)
  - "Em Andamento" (Botão: Editar)
  - "Atrasado" (Se data atual > deadline e não enviado)

## 5. Plano de Execução

1. **Database**: Criar esquema (`drizzle`) e rodar migration.
2. **Backend**: Criar Serviço e Controller de `PlanningTemplates`.
3. **Frontend Gestão**: Criar página e formulários de cadastro.
4. **Integração**: Conectar o dashboard da professora à nova fonte de dados.
