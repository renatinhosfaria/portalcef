import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "./index.js";

dotenv.config({ path: "../../.env" });

async function inspect() {
  const db = getDb();
  console.log("🔍 Inspecting 'users' table columns...");

  try {
    const res = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log("Cols:", res);
  } catch (err) {
    console.error("Error inspecting:", err);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

inspect();
