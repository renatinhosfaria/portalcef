import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
dotenv.config({ path: "../../.env" });

export default defineConfig({
  schema: "./dist/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
