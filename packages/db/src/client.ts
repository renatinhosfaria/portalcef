import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

/**
 * Database connection factory
 * Creates and manages a singleton database connection to prevent connection leaks
 */

// Connection instance (singleton for the API server)
let connection: postgres.Sql | null = null;

function getConnection(): postgres.Sql {
  if (!connection) {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/essencia";

    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    connection = postgres(connectionString, {
      max: 10, // Maximum connections in the pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Timeout for establishing connection
    });
  }

  return connection;
}

/**
 * Get the Drizzle database instance
 * Use this in the API server for all database operations
 */
export function getDb() {
  return drizzle(getConnection(), { schema });
}

/**
 * Close the database connection
 * Call this on server shutdown to clean up connections
 */
export async function closeDb(): Promise<void> {
  if (connection) {
    await connection.end();
    connection = null;
  }
}

// Export the schema for convenience
export { schema };

// Export the db type for typing
export type Database = ReturnType<typeof getDb>;
