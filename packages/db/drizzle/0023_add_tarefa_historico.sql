-- Migration: 0023_add_tarefa_historico.sql
-- Adiciona tabela de histórico de ações em tarefas

CREATE TABLE IF NOT EXISTS "tarefa_historico" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tarefa_id"      UUID NOT NULL,
  "user_id"        UUID NOT NULL,
  "user_name"      TEXT NOT NULL,
  "user_role"      TEXT NOT NULL,
  "acao"           TEXT NOT NULL,
  "campo_alterado" TEXT,
  "valor_anterior" TEXT,
  "valor_novo"     TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "fk_tarefa_historico_tarefa"
    FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_tarefa_historico_user"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "chk_tarefa_historico_acao"
    CHECK ("acao" IN ('CRIADA', 'EDITADA', 'CONCLUIDA', 'CANCELADA'))
);

CREATE INDEX IF NOT EXISTS "idx_tarefa_historico_tarefa_id"
  ON "tarefa_historico"("tarefa_id");
CREATE INDEX IF NOT EXISTS "idx_tarefa_historico_created_at"
  ON "tarefa_historico"("created_at" DESC);
