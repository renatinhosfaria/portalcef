const postgres = require("postgres");
require("dotenv").config({ path: "../../.env" });

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  // Check if table exists
  const res = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'calendar_events'
    );
  `;

  if (res[0].exists) {
    console.log("Table calendar_events already exists");
  } else {
    console.log("Creating table calendar_events...");
    await sql`
      CREATE TABLE "calendar_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "unit_id" uuid NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "event_type" text NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "is_school_day" boolean DEFAULT true NOT NULL,
        "is_recurring_annually" boolean DEFAULT false NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    await sql`
      ALTER TABLE "calendar_events" 
      ADD CONSTRAINT "calendar_events_unit_id_units_id_fk" 
      FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") 
      ON DELETE cascade ON UPDATE no action
    `;

    await sql`
      ALTER TABLE "calendar_events" 
      ADD CONSTRAINT "calendar_events_created_by_users_id_fk" 
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") 
      ON DELETE set null ON UPDATE no action
    `;

    await sql`
      CREATE INDEX "calendar_events_unit_date_idx" 
      ON "calendar_events" USING btree ("unit_id","start_date","end_date")
    `;

    await sql`
      CREATE INDEX "calendar_events_type_idx" 
      ON "calendar_events" USING btree ("event_type")
    `;

    console.log("Table calendar_events created successfully!");
  }

  await sql.end();
}

run().catch(console.error);
