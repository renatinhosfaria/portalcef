-- Corrige o domínio do módulo Relatórios: períodos são semestrais, não semanais.

DO $$
BEGIN
  IF to_regclass('public.semestre_relatorio') IS NULL
     AND to_regclass('public.semana_relatorio') IS NOT NULL THEN
    ALTER TABLE "semana_relatorio" RENAME TO "semestre_relatorio";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'semestre_relatorio'
      AND column_name = 'numero'
  ) THEN
    ALTER TABLE "semestre_relatorio"
      RENAME COLUMN "numero" TO "semestre";
  END IF;
END $$;

ALTER TABLE "semestre_relatorio"
  ADD COLUMN IF NOT EXISTS "ano_letivo" integer;

UPDATE "semestre_relatorio"
SET "ano_letivo" = EXTRACT(YEAR FROM "data_inicio")::integer
WHERE "ano_letivo" IS NULL;

ALTER TABLE "semestre_relatorio"
  ALTER COLUMN "ano_letivo" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semana_relatorio_unidade_id_units_id_fk'
      AND conrelid = 'public.semestre_relatorio'::regclass
  ) THEN
    ALTER TABLE "semestre_relatorio"
      RENAME CONSTRAINT "semana_relatorio_unidade_id_units_id_fk"
      TO "semestre_relatorio_unidade_id_units_id_fk";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semana_relatorio_criado_por_users_id_fk'
      AND conrelid = 'public.semestre_relatorio'::regclass
  ) THEN
    ALTER TABLE "semestre_relatorio"
      RENAME CONSTRAINT "semana_relatorio_criado_por_users_id_fk"
      TO "semestre_relatorio_criado_por_users_id_fk";
  END IF;
END $$;

DROP INDEX IF EXISTS "semana_relatorio_unidade_etapa_numero_unique";
DROP INDEX IF EXISTS "idx_semana_relatorio_unidade";
DROP INDEX IF EXISTS "idx_semana_relatorio_etapa";
DROP INDEX IF EXISTS "idx_semana_relatorio_datas";

CREATE UNIQUE INDEX IF NOT EXISTS "semestre_relatorio_unidade_etapa_ano_semestre_unique"
  ON "semestre_relatorio" USING btree ("unidade_id", "etapa", "ano_letivo", "semestre");
CREATE INDEX IF NOT EXISTS "idx_semestre_relatorio_unidade"
  ON "semestre_relatorio" USING btree ("unidade_id");
CREATE INDEX IF NOT EXISTS "idx_semestre_relatorio_etapa"
  ON "semestre_relatorio" USING btree ("etapa");
CREATE INDEX IF NOT EXISTS "idx_semestre_relatorio_datas"
  ON "semestre_relatorio" USING btree ("data_inicio", "data_fim");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'relatorio'
      AND column_name = 'semana_relatorio_id'
  ) THEN
    ALTER TABLE "relatorio"
      RENAME COLUMN "semana_relatorio_id" TO "semestre_relatorio_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'relatorio'
      AND column_name = 'semana_id'
  ) THEN
    ALTER TABLE "relatorio"
      RENAME COLUMN "semana_id" TO "semestre_id";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'relatorio_semana_relatorio_id_semana_relatorio_id_fk'
      AND conrelid = 'public.relatorio'::regclass
  ) THEN
    ALTER TABLE "relatorio"
      RENAME CONSTRAINT "relatorio_semana_relatorio_id_semana_relatorio_id_fk"
      TO "relatorio_semestre_relatorio_id_semestre_relatorio_id_fk";
  END IF;
END $$;

DROP INDEX IF EXISTS "relatorio_user_turma_semana_unique";
DROP INDEX IF EXISTS "relatorio_semana_id_idx";
DROP INDEX IF EXISTS "relatorio_semana_relatorio_id_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "relatorio_user_turma_semestre_unique"
  ON "relatorio" USING btree ("user_id", "turma_id", "semestre_id");
CREATE INDEX IF NOT EXISTS "relatorio_semestre_id_idx"
  ON "relatorio" USING btree ("semestre_id");
CREATE INDEX IF NOT EXISTS "relatorio_semestre_relatorio_id_idx"
  ON "relatorio" USING btree ("semestre_relatorio_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semestre_relatorio_semestre_check'
      AND conrelid = 'public.semestre_relatorio'::regclass
  ) THEN
    ALTER TABLE "semestre_relatorio"
      ADD CONSTRAINT "semestre_relatorio_semestre_check"
      CHECK ("semestre" IN (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semestre_relatorio_ano_letivo_check'
      AND conrelid = 'public.semestre_relatorio'::regclass
  ) THEN
    ALTER TABLE "semestre_relatorio"
      ADD CONSTRAINT "semestre_relatorio_ano_letivo_check"
      CHECK ("ano_letivo" BETWEEN 2000 AND 2100);
  END IF;
END $$;
