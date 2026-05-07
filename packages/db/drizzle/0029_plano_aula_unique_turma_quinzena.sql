-- Migration: 0029_plano_aula_unique_turma_quinzena.sql
-- ATENÇÃO: NÃO APLICAR enquanto existirem duplicatas em (turma_id, quinzena_id).
-- Esta migration deve ser executada apenas após as duplicatas atuais serem
-- resolvidas manualmente (por decisão pedagógica de qual plano manter).
--
-- Para verificar o estado atual:
--   SELECT turma_id, quinzena_id, COUNT(*)
--   FROM plano_aula
--   GROUP BY turma_id, quinzena_id
--   HAVING COUNT(*) > 1;
--
-- Substitui o índice único (user_id, turma_id, quinzena_id) por (turma_id, quinzena_id).
-- Pedagogicamente, uma turma tem um único plano por quinzena — independentemente
-- de qual professora é responsável (a responsabilidade pode mudar via transferência).

DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT turma_id, quinzena_id
    FROM plano_aula
    GROUP BY turma_id, quinzena_id
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Existem % grupos duplicados em (turma_id, quinzena_id). Resolva manualmente antes de aplicar esta migration.', duplicate_count;
  END IF;
END $$;

DROP INDEX "plano_aula_user_turma_quinzena_unique";
CREATE UNIQUE INDEX "plano_aula_turma_quinzena_unique"
  ON "plano_aula" USING btree ("turma_id","quinzena_id");
