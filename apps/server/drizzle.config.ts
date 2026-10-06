import { defineConfig } from "drizzle-kit";

/** Drizzle Kit: turns src/db/schema.ts into SQL migration files (./drizzle) */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DB_FILE ?? "./data/medicare.sqlite" },
});
