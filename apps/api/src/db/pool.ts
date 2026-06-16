import pg from "pg";
import { z } from "zod";
import "../config/load-env";

const { Pool } = pg;

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

export async function checkDatabase() {
  const result = await pool.query<{ ok: number }>("select 1 as ok");
  return result.rows[0]?.ok === 1;
}
