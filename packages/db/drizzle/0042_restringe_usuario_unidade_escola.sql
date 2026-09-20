-- Custom SQL migration file, put your code below! --
-- Defesa em profundidade da relação usuário–unidade–escola.
-- O preflight aborta a migration antes de qualquer DDL quando há dados
-- inconsistentes; a correção deve ser feita separadamente e auditada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users" AS u
    LEFT JOIN "units" AS un ON un."id" = u."unit_id"
    WHERE u."unit_id" IS NOT NULL
      AND (
        u."school_id" IS NULL
        OR un."id" IS NULL
        OR u."school_id" IS DISTINCT FROM un."school_id"
      )
  ) THEN
    RAISE EXCEPTION
      'Migration abortada: existem usuários com escola e unidade inconsistentes';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "units_id_school_id_unique"
  ON "units" USING btree ("id", "school_id");
--> statement-breakpoint
ALTER TABLE "users"
  ADD CONSTRAINT "users_unit_school_fk"
  FOREIGN KEY ("unit_id", "school_id")
  REFERENCES "units" ("id", "school_id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "users"
  ADD CONSTRAINT "users_unit_requires_school"
  CHECK ("unit_id" IS NULL OR "school_id" IS NOT NULL);
