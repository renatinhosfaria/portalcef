-- Migration: 0011_add_historico_tarefas.sql

-- Tabela de histórico de planos de aula
CREATE TABLE IF NOT EXISTS "plano_aula_historico" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plano_id" UUID NOT NULL REFERENCES "plano_aula"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "user_name" TEXT NOT NULL,
  "user_role" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "status_anterior" TEXT,
  "status_novo" TEXT NOT NULL,
  "detalhes" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices para histórico
CREATE INDEX IF NOT EXISTS "idx_plano_historico_plano_id" ON "plano_aula_historico"("plano_id");
CREATE INDEX IF NOT EXISTS "idx_plano_historico_created_at" ON "plano_aula_historico"("created_at" DESC);

-- Tabela de tarefas
CREATE TABLE IF NOT EXISTS "tarefas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL REFERENCES "schools"("id"),
  "unit_id" UUID REFERENCES "units"("id"),
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "prioridade" TEXT NOT NULL,
  "prazo" TIMESTAMP NOT NULL,
  "criado_por" UUID NOT NULL REFERENCES "users"("id"),
  "responsavel" UUID NOT NULL REFERENCES "users"("id"),
  "tipo_origem" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "concluida_em" TIMESTAMP
);

-- Índices para tarefas
CREATE INDEX IF NOT EXISTS "idx_tarefas_responsavel" ON "tarefas"("responsavel");
CREATE INDEX IF NOT EXISTS "idx_tarefas_criado_por" ON "tarefas"("criado_por");
CREATE INDEX IF NOT EXISTS "idx_tarefas_school_id" ON "tarefas"("school_id");
CREATE INDEX IF NOT EXISTS "idx_tarefas_unit_id" ON "tarefas"("unit_id");
CREATE INDEX IF NOT EXISTS "idx_tarefas_status" ON "tarefas"("status");
CREATE INDEX IF NOT EXISTS "idx_tarefas_prazo" ON "tarefas"("prazo");

-- Tabela de contextos de tarefas
CREATE TABLE IF NOT EXISTS "tarefa_contextos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tarefa_id" UUID NOT NULL REFERENCES "tarefas"("id") ON DELETE CASCADE,
  "modulo" TEXT NOT NULL,
  "quinzena_id" VARCHAR(10),
  "etapa_id" UUID REFERENCES "education_stages"("id"),
  "turma_id" UUID REFERENCES "turmas"("id"),
  "professora_id" UUID REFERENCES "users"("id")
);

-- Índices para contextos
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_tarefa_id" ON "tarefa_contextos"("tarefa_id");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_modulo" ON "tarefa_contextos"("modulo");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_quinzena_id" ON "tarefa_contextos"("quinzena_id");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_turma_id" ON "tarefa_contextos"("turma_id");
