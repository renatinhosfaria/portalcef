ALTER TABLE "shop_interest_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'PENDENTE';

UPDATE "shop_interest_requests"
SET "status" = CASE
  WHEN "contacted_at" IS NOT NULL THEN 'CONTATADO'
  ELSE 'PENDENTE'
END
WHERE "status" IS NULL;

ALTER TABLE "shop_interest_requests"
  ALTER COLUMN "status" SET DEFAULT 'PENDENTE';

ALTER TABLE "shop_interest_requests"
  ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "shop_interest_requests_status_idx"
  ON "shop_interest_requests" USING btree ("status");
