import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL não definida no .env');
  process.exit(1);
}

console.log('🔌 Conectando ao PostgreSQL...');

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function applyShopMigration() {
  try {
    console.log('🚀 Aplicando tabelas do módulo shop...\n');

    // Criar tabelas shop em ordem de dependência
    await sql`
      CREATE TABLE IF NOT EXISTS "shop_products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "school_id" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "description" text,
        "image_url" varchar(500),
        "base_price" integer NOT NULL,
        "category" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Tabela shop_products criada');

    await sql`
      CREATE TABLE IF NOT EXISTS "shop_product_variants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "product_id" uuid NOT NULL,
        "size" varchar(20) NOT NULL,
        "sku" varchar(100),
        "price_override" integer,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Tabela shop_product_variants criada');

    await sql`
      CREATE TABLE IF NOT EXISTS "shop_inventory" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "variant_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "quantity" integer DEFAULT 0 NOT NULL,
        "reserved_quantity" integer DEFAULT 0 NOT NULL,
        "low_stock_threshold" integer DEFAULT 5,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Tabela shop_inventory criada');

    await sql`
      CREATE TABLE IF NOT EXISTS "shop_inventory_ledger" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "inventory_id" uuid NOT NULL,
        "movement_type" text NOT NULL,
        "quantity_change" integer NOT NULL,
        "reference_id" uuid,
        "notes" text,
        "created_by" uuid,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Tabela shop_inventory_ledger criada');

    await sql`
      CREATE TABLE IF NOT EXISTS "shop_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "school_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "order_number" varchar(20) NOT NULL,
        "status" text DEFAULT 'AGUARDANDO_PAGAMENTO' NOT NULL,
        "order_source" text DEFAULT 'ONLINE' NOT NULL,
        "customer_name" varchar(200) NOT NULL,
        "customer_phone" varchar(20) NOT NULL,
        "customer_email" varchar(100),
        "total_amount" integer NOT NULL,
        "installments" integer DEFAULT 1,
        "payment_method" text,
        "stripe_payment_intent_id" varchar(255),
        "expires_at" timestamp with time zone,
        "paid_at" timestamp with time zone,
        "picked_up_at" timestamp with time zone,
        "picked_up_by" uuid,
        "cancelled_at" timestamp with time zone,
        "cancelled_by" uuid,
        "cancellation_reason" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "shop_orders_order_number_unique" UNIQUE("order_number")
      );
    `;
    console.log('✅ Tabela shop_orders criada');

    await sql`
      CREATE TABLE IF NOT EXISTS "shop_order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "order_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "student_name" varchar(200) NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price" integer NOT NULL
      );
    `;
    console.log('✅ Tabela shop_order_items criada');

    await sql`
      CREATE TABLE IF NOT EXISTS "shop_interest_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "school_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "customer_name" varchar(200) NOT NULL,
        "customer_phone" varchar(20) NOT NULL,
        "customer_email" varchar(100),
        "student_name" varchar(200) NOT NULL,
        "student_class" varchar(50),
        "notes" text,
        "contacted_at" timestamp with time zone,
        "contacted_by" uuid,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Tabela shop_interest_requests criada');

    await sql`
      CREATE TABLE IF NOT EXISTS "shop_interest_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "interest_request_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Tabela shop_interest_items criada');

    await sql`
      CREATE TABLE IF NOT EXISTS "shop_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "unit_id" uuid NOT NULL,
        "max_installments" integer DEFAULT 1 NOT NULL,
        "is_shop_enabled" boolean DEFAULT true NOT NULL,
        "pickup_instructions" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "shop_settings_unit_id_unique" UNIQUE("unit_id")
      );
    `;
    console.log('✅ Tabela shop_settings criada');

    console.log('\n🔗 Criando foreign keys...\n');

    // Foreign keys
    await sql`ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_product_variants" ADD CONSTRAINT "shop_product_variants_product_id_shop_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_inventory" ADD CONSTRAINT "shop_inventory_variant_id_shop_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."shop_product_variants"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_inventory" ADD CONSTRAINT "shop_inventory_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_inventory_ledger" ADD CONSTRAINT "shop_inventory_ledger_inventory_id_shop_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."shop_inventory"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_inventory_ledger" ADD CONSTRAINT "shop_inventory_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_picked_up_by_users_id_fk" FOREIGN KEY ("picked_up_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_variant_id_shop_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."shop_product_variants"("id") ON DELETE restrict ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_interest_requests" ADD CONSTRAINT "shop_interest_requests_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_interest_requests" ADD CONSTRAINT "shop_interest_requests_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_interest_requests" ADD CONSTRAINT "shop_interest_requests_contacted_by_users_id_fk" FOREIGN KEY ("contacted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_interest_items" ADD CONSTRAINT "shop_interest_items_interest_request_id_shop_interest_requests_id_fk" FOREIGN KEY ("interest_request_id") REFERENCES "public"."shop_interest_requests"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_interest_items" ADD CONSTRAINT "shop_interest_items_variant_id_shop_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."shop_product_variants"("id") ON DELETE cascade ON UPDATE no action;`;
    await sql`ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;`;
    
    console.log('✅ Foreign keys criadas');

    console.log('\n📊 Criando índices...\n');

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS "shop_products_school_id_idx" ON "shop_products" USING btree ("school_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_products_category_idx" ON "shop_products" USING btree ("category");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_products_is_active_idx" ON "shop_products" USING btree ("is_active");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_product_variants_product_id_idx" ON "shop_product_variants" USING btree ("product_id");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "shop_product_variants_product_size_unique" ON "shop_product_variants" USING btree ("product_id","size");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_inventory_unit_id_idx" ON "shop_inventory" USING btree ("unit_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_inventory_quantity_idx" ON "shop_inventory" USING btree ("quantity");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "shop_inventory_variant_unit_unique" ON "shop_inventory" USING btree ("variant_id","unit_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_inventory_ledger_inventory_id_idx" ON "shop_inventory_ledger" USING btree ("inventory_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_inventory_ledger_movement_type_idx" ON "shop_inventory_ledger" USING btree ("movement_type");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_inventory_ledger_created_at_idx" ON "shop_inventory_ledger" USING btree ("created_at");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_inventory_ledger_reference_id_idx" ON "shop_inventory_ledger" USING btree ("reference_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_orders_school_id_idx" ON "shop_orders" USING btree ("school_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_orders_unit_id_idx" ON "shop_orders" USING btree ("unit_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_orders_status_idx" ON "shop_orders" USING btree ("status");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_orders_customer_phone_idx" ON "shop_orders" USING btree ("customer_phone");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_orders_created_at_idx" ON "shop_orders" USING btree ("created_at");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_orders_expires_at_idx" ON "shop_orders" USING btree ("expires_at");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "shop_orders_order_number_unique" ON "shop_orders" USING btree ("order_number");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_order_items_order_id_idx" ON "shop_order_items" USING btree ("order_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_order_items_variant_id_idx" ON "shop_order_items" USING btree ("variant_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_interest_requests_school_id_idx" ON "shop_interest_requests" USING btree ("school_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_interest_requests_unit_id_idx" ON "shop_interest_requests" USING btree ("unit_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_interest_requests_customer_phone_idx" ON "shop_interest_requests" USING btree ("customer_phone");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_interest_requests_contacted_at_idx" ON "shop_interest_requests" USING btree ("contacted_at");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_interest_requests_created_at_idx" ON "shop_interest_requests" USING btree ("created_at");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_interest_items_interest_request_id_idx" ON "shop_interest_items" USING btree ("interest_request_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "shop_interest_items_variant_id_idx" ON "shop_interest_items" USING btree ("variant_id");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "shop_settings_unit_id_unique" ON "shop_settings" USING btree ("unit_id");`;

    console.log('✅ Índices criados (25 índices)');

    console.log('\n✅ Migration do módulo shop aplicada com sucesso!\n');
    console.log('📊 Resumo:');
    console.log('  - 9 tabelas criadas');
    console.log('  - 17 foreign keys adicionadas');
    console.log('  - 25 índices criados\n');

  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyShopMigration()
  .then(() => {
    console.log('🎉 Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha na aplicação da migration:', error);
    process.exit(1);
  });
