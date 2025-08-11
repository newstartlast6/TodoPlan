import { defineConfig } from "drizzle-kit";

// Do not throw at import time; drizzle-kit will pass env at runtime.
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
