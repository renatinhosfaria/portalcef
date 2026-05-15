ALTER TABLE "evento_inscricoes"
  ADD COLUMN IF NOT EXISTS "presenca_confirmada_em" timestamptz,
  ADD COLUMN IF NOT EXISTS "presenca_confirmada_por" uuid;

CREATE TABLE IF NOT EXISTS "evento_sorteios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "evento_slug" varchar(80) NOT NULL,
  "brinde" varchar(200) NOT NULL,
  "inscricao_id" uuid NOT NULL,
  "numero_inscricao" varchar(7) NOT NULL,
  "sorteado_em" timestamptz NOT NULL DEFAULT now(),
  "sorteado_por" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "evento_sorteios_inscricao_id_fk"
    FOREIGN KEY ("inscricao_id")
    REFERENCES "evento_inscricoes"("id")
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_evento_sorteios_evento_inscricao"
  ON "evento_sorteios" USING btree ("evento_slug", "inscricao_id");

CREATE INDEX IF NOT EXISTS "idx_evento_sorteios_evento_slug"
  ON "evento_sorteios" USING btree ("evento_slug");

CREATE INDEX IF NOT EXISTS "idx_evento_sorteios_sorteado_em"
  ON "evento_sorteios" USING btree ("sorteado_em" DESC);

CREATE INDEX IF NOT EXISTS "idx_evento_inscricoes_presenca"
  ON "evento_inscricoes" USING btree ("evento_slug", "presenca_confirmada_em");
