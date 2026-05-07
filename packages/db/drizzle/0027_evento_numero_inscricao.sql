-- Adiciona número de inscrição amigável (formato "XXX-XXX") nas inscrições de evento.
-- A coluna é populada com um número aleatório único por evento.

-- 1) Adicionar coluna nullable
ALTER TABLE "evento_inscricoes"
  ADD COLUMN IF NOT EXISTS "numero_inscricao" varchar(7);

-- 2) Popular registros existentes com números aleatórios únicos por evento
DO $$
DECLARE
  rec RECORD;
  numero text;
  tentativas int;
BEGIN
  FOR rec IN
    SELECT id, evento_slug FROM "evento_inscricoes" WHERE "numero_inscricao" IS NULL
  LOOP
    tentativas := 0;
    LOOP
      -- gera 6 dígitos no formato XXX-XXX
      numero := lpad(floor(random() * 1000)::int::text, 3, '0')
             || '-'
             || lpad(floor(random() * 1000)::int::text, 3, '0');
      tentativas := tentativas + 1;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "evento_inscricoes"
        WHERE evento_slug = rec.evento_slug
          AND numero_inscricao = numero
      );
      IF tentativas > 50 THEN
        RAISE EXCEPTION 'Não foi possível gerar número único para inscrição %', rec.id;
      END IF;
    END LOOP;
    UPDATE "evento_inscricoes"
       SET numero_inscricao = numero
     WHERE id = rec.id;
  END LOOP;
END$$;

-- 3) Tornar NOT NULL e criar índice único composto (evento_slug, numero_inscricao)
ALTER TABLE "evento_inscricoes"
  ALTER COLUMN "numero_inscricao" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_evento_inscricoes_evento_numero"
  ON "evento_inscricoes" USING btree ("evento_slug", "numero_inscricao");
