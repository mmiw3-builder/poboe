import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * libSQL: `file:./dev.db` locally with zero config; set DATABASE_URL
 * (+ DATABASE_AUTH_TOKEN for Turso) in production.
 */

let client: Client | null = null;
let database: LibSQLDatabase<typeof schema> | null = null;

export function db(): LibSQLDatabase<typeof schema> {
  if (!database) {
    client = createClient({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    database = drizzle(client, { schema });
  }
  return database;
}

export { schema };
