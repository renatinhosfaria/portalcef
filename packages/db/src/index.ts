export { closeDb, getDb, schema, type Database } from "./client.js";
export * from "./schema/index.js";
// Re-export drizzle-orm operators to ensure same instance across packages
export {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  or,
  sql,
} from "drizzle-orm";
