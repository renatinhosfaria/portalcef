import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { closeDb, getDb } from "./index.js";

dotenv.config({ path: "../../.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  const db = getDb();
  console.log("🛠️ Initializing database from SQL...");

  try {
    const sqlPath = path.resolve(__dirname, "../drizzle/0000_init.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");

    // Split by statement-breakpoint or ;
    // Drizzle uses --> statement-breakpoint
    const statements = sqlContent.split("--> statement-breakpoint");

    for (const statement of statements) {
      if (statement.trim()) {
        await db.execute(sql.raw(statement));
      }
    }

    console.log("✅ Database initialized successfully!");
  } catch (error) {
    console.error("❌ Init failed:", error);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

initDb();
