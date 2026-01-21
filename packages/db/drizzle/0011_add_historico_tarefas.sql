-- Migration: 0011_add_historico_tarefas.sql

-- Tabela de histórico de planos de aula
CREATE TABLE IF NOT EXISTS "plano_aula_historico" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plano_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "user_name" TEXT NOT NULL,
  "user_role" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "status_anterior" TEXT,
  "status_novo" TEXT NOT NULL,
  "detalhes" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  -- Foreign Keys com nomes explícitos
  CONSTRAINT "fk_plano_historico_plano" FOREIGN KEY ("plano_id") REFERENCES "plano_aula"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_plano_historico_user" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  -- CHECK constraints para enums
  CONSTRAINT "chk_plano_historico_acao" CHECK ("acao" IN (
    'CRIADO',
    'SUBMETIDO',
    'APROVADO_ANALISTA',
    'DEVOLVIDO_ANALISTA',
    'APROVADO_COORDENADORA',
    'DEVOLVIDO_COORDENADORA'
  ))
);

-- Índices para histórico
CREATE INDEX IF NOT EXISTS "idx_plano_historico_plano_id" ON "plano_aula_historico"("plano_id");
CREATE INDEX IF NOT EXISTS "idx_plano_historico_created_at" ON "plano_aula_historico"("created_at" DESC);

-- Tabela de tarefas
CREATE TABLE IF NOT EXISTS "tarefas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "unit_id" UUID,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "prioridade" TEXT NOT NULL,
  "prazo" TIMESTAMP WITH TIME ZONE NOT NULL,
  "criado_por" UUID NOT NULL,
  "responsavel" UUID NOT NULL,
  "tipo_origem" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "concluida_em" TIMESTAMP WITH TIME ZONE,
  -- Foreign Keys com nomes explícitos
  CONSTRAINT "fk_tarefas_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
  CONSTRAINT "fk_tarefas_unit" FOREIGN KEY ("unit_id") REFERENCES "units"("id"),
  CONSTRAINT "fk_tarefas_criado_por" FOREIGN KEY ("criado_por") REFERENCES "users"("id"),
  CONSTRAINT "fk_tarefas_responsavel" FOREIGN KEY ("responsavel") REFERENCES "users"("id"),
  -- CHECK constraints para enums
  CONSTRAINT "chk_tarefas_status" CHECK ("status" IN ('PENDENTE', 'CONCLUIDA', 'CANCELADA')),
  CONSTRAINT "chk_tarefas_prioridade" CHECK ("prioridade" IN ('ALTA', 'MEDIA', 'BAIXA')),
  CONSTRAINT "chk_tarefas_tipo_origem" CHECK ("tipo_origem" IN ('AUTOMATICA', 'MANUAL')),
  -- Validação entre status e timestamps
  CONSTRAINT "chk_tarefas_status_timestamp" CHECK (
    ("status" = 'CONCLUIDA' AND "concluida_em" IS NOT NULL) OR
    ("status" != 'CONCLUIDA' AND "concluida_em" IS NULL)
  )
);

-- Índices para tarefas
CREATE INDEX IF NOT EXISTS "idx_tarefas_responsavel" ON "tarefas"("responsavel");
CREATE INDEX IF NOT EXISTS "idx_tarefas_criado_por" ON "tarefas"("criado_por");
CREATE INDEX IF NOT EXISTS "idx_tarefas_school_id" ON "tarefas"("school_id");
CREATE INDEX IF NOT EXISTS "idx_tarefas_unit_id" ON "tarefas"("unit_id");
CREATE INDEX IF NOT EXISTS "idx_tarefas_status" ON "tarefas"("status");
CREATE INDEX IF NOT EXISTS "idx_tarefas_prazo" ON "tarefas"("prazo");

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS "idx_tarefas_responsavel_status" ON "tarefas"("responsavel", "status");
CREATE INDEX IF NOT EXISTS "idx_tarefas_responsavel_prazo" ON "tarefas"("responsavel", "prazo");

-- Tabela de contextos de tarefas
CREATE TABLE IF NOT EXISTS "tarefa_contextos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tarefa_id" UUID NOT NULL,
  "modulo" TEXT NOT NULL,
  "quinzena_id" VARCHAR(10),
  "etapa_id" UUID,
  "turma_id" UUID,
  "professora_id" UUID,
  -- Foreign Keys com nomes explícitos
  CONSTRAINT "fk_tarefa_contextos_tarefa" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_tarefa_contextos_etapa" FOREIGN KEY ("etapa_id") REFERENCES "education_stages"("id"),
  CONSTRAINT "fk_tarefa_contextos_turma" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id"),
  CONSTRAINT "fk_tarefa_contextos_professora" FOREIGN KEY ("professora_id") REFERENCES "users"("id"),
  -- CHECK constraints para enums
  CONSTRAINT "chk_tarefa_contextos_modulo" CHECK ("modulo" IN (
    'PLANEJAMENTO',
    'CALENDARIO',
    'USUARIOS',
    'TURMAS',
    'LOJA'
  ))
);

-- Índices para contextos
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_tarefa_id" ON "tarefa_contextos"("tarefa_id");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_modulo" ON "tarefa_contextos"("modulo");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_quinzena_id" ON "tarefa_contextos"("quinzena_id");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_turma_id" ON "tarefa_contextos"("turma_id");

-- Trigger para auto-atualizar updated_at em tarefas
CREATE OR REPLACE FUNCTION update_tarefas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tarefas_updated_at
  BEFORE UPDATE ON "tarefas"
  FOR EACH ROW
  EXECUTE FUNCTION update_tarefas_updated_at();
