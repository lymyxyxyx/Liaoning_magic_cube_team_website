import { Pool } from "pg";

let pool: Pool | undefined;

function readPositiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getPostgresPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: readPositiveInteger("PG_POOL_MAX", 10),
      idleTimeoutMillis: readPositiveInteger("PG_POOL_IDLE_TIMEOUT_MS", 30_000),
      connectionTimeoutMillis: readPositiveInteger("PG_POOL_CONNECTION_TIMEOUT_MS", 5_000)
    });
    pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error", error);
    });
  }

  return pool;
}
