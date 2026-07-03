UPDATE "prova"
SET
  "status" = 'AGUARDANDO_ANALISTA',
  "updated_at" = NOW()
WHERE "status" = 'AGUARDANDO_RESPOSTA';
