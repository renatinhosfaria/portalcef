CREATE TABLE "shop_product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"image_url" varchar(500) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_product_images" ADD CONSTRAINT "shop_product_images_product_id_shop_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_product_images_product_id_idx" ON "shop_product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "shop_product_images_display_order_idx" ON "shop_product_images" USING btree ("display_order");