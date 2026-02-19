import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, closeDb } from "./client.js";
import path from "path";

async function runMigrations() {
  console.log("Starting deployment migrations...");

  // In CJS, __dirname is available globally/scope
  // dist/migrate.js -> dist -> db -> drizzle is sibling of dist

  const migrationsFolder = path.resolve(__dirname, "../drizzle");

  console.log(`Using migrations folder: ${migrationsFolder}`);

  const db = getDb();

  // This will run all pending migrations
  await migrate(db, { migrationsFolder });

  console.log("Migrations applied successfully!");
  await closeDb();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
