import "../config/load-env";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { quoteIdentifier } from "./identifiers";
import { pool } from "./pool";
import { tenantSchemaSql } from "./sql/tenant-template";

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

async function migrateTenantSchemas() {
  const tenants = await pool.query<{ schema_name: string }>(
    "select schema_name from core.tenants where status <> 'removed'",
  );

  for (const tenant of tenants.rows) {
    const schema = quoteIdentifier(tenant.schema_name);
    await pool.query("begin");
    try {
      await pool.query(tenantSchemaSql(tenant.schema_name));
      await pool.query(
        `insert into ${schema}.tenant_migrations (id)
         values ($1)
         on conflict (id) do nothing`,
        ["003_schedule_series"],
      );
      await pool.query("commit");
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}

try {
  await migrateCore();
  await migrateTenantSchemas();
  console.log("Database migrations completed");
} finally {
  await pool.end();
}
