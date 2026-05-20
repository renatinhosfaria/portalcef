ALTER TABLE "shop_products"
ADD COLUMN IF NOT EXISTS "is_pre_sale" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "shop_products_is_pre_sale_idx"
ON "shop_products" ("is_pre_sale");
