import postgres from "postgres";
import * as schema from "./schema/index.js";
/**
 * Get the Drizzle database instance
 * Use this in the API server for all database operations
 */
export declare function getDb(): import("drizzle-orm/postgres-js").PostgresJsDatabase<
  typeof schema
> & {
  $client: postgres.Sql<{}>;
};
/**
 * Close the database connection
 * Call this on server shutdown to clean up connections
 */
export declare function closeDb(): Promise<void>;
export { schema };
export type Database = ReturnType<typeof getDb>;
//# sourceMappingURL=client.d.ts.map
