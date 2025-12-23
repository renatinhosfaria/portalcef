import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "./index.js";

dotenv.config({ path: "../../.env" });

async function reset() {
  const db = getDb();
  console.log("🗑️ Dropping all tables...");

  try {
    // Drop schemas/tables
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);

    console.log("✅ Database reset successfully!");
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

reset();
