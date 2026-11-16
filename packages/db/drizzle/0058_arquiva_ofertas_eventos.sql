UPDATE "evento_ofertas"
SET "active" = false,
    "updated_at" = now()
WHERE "active" = true;
