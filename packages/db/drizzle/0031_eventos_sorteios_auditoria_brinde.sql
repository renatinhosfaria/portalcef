CREATE UNIQUE INDEX IF NOT EXISTS "uq_evento_sorteios_evento_brinde"
  ON "evento_sorteios" USING btree ("evento_slug", lower(btrim("brinde")));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evento_inscricoes_presenca_confirmada_por_users_id_fk'
  ) THEN
    ALTER TABLE "evento_inscricoes"
      ADD CONSTRAINT "evento_inscricoes_presenca_confirmada_por_users_id_fk"
      FOREIGN KEY ("presenca_confirmada_por")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "evento_inscricoes"
  VALIDATE CONSTRAINT "evento_inscricoes_presenca_confirmada_por_users_id_fk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evento_sorteios_sorteado_por_users_id_fk'
  ) THEN
    ALTER TABLE "evento_sorteios"
      ADD CONSTRAINT "evento_sorteios_sorteado_por_users_id_fk"
      FOREIGN KEY ("sorteado_por")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "evento_sorteios"
  VALIDATE CONSTRAINT "evento_sorteios_sorteado_por_users_id_fk";
