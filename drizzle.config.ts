import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./src/infra/db/schema/index.ts",
  out: "./src/infra/db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
