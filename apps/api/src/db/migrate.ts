import "../config/load-env";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool";

const currentDir = dirname(fileURLToPath(import.meta.url));
const coreSqlPath = join(currentDir, "sql", "core.sql");

async function migrateCore() {
  const sql = await readFile(coreSqlPath, "utf8");

  await pool.query("begin");
  try {
    await pool.query(sql);
    await pool.query(
      `insert into core.platform_migrations (id)
       values ($1)
       on conflict (id) do nothing`,
      ["001_core"],
    );
    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }
}

try {
  await migrateCore();
  console.log("Database migrations completed");
} finally {
  await pool.end();
}
