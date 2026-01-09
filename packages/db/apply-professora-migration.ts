import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import { getDb } from "./src/client.js";
import { sql } from "drizzle-orm";

async function applyMigration() {
  const db = getDb();

  try {
    console.log("Aplicando migration: adicionar coluna professora_id...");

    // Adicionar coluna professora_id
    await db.execute(
      sql`ALTER TABLE "turmas" ADD COLUMN IF NOT EXISTS "professora_id" uuid`,
    );

    // Adicionar foreign key constraint
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'turmas_professora_id_users_id_fk'
        ) THEN
          ALTER TABLE "turmas"
          ADD CONSTRAINT "turmas_professora_id_users_id_fk"
          FOREIGN KEY ("professora_id")
          REFERENCES "public"."users"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    console.log("✅ Migration aplicada com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao aplicar migration:", error);
    throw error;
  }
}

applyMigration()
  .then(() => {
    console.log("Processo concluído");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Processo falhou:", error);
    process.exit(1);
  });
