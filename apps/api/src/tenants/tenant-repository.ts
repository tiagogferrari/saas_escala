import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { createTenantSchemaName, quoteIdentifier } from "../db/identifiers";
import { pool } from "../db/pool";
import { tenantSchemaSql } from "../db/sql/tenant-template";

export type Tenant = {
  id: string;
  slug: string;
  displayName: string;
  schemaName: string;
  timezone: string;
  locale: string;
  status: string;
  createdAt: string;
};

export type CreateTenantInput = {
  slug: string;
  displayName: string;
  timezone: string;
  locale: string;
};

type TenantRow = {
  id: string;
  slug: string;
  display_name: string;
  schema_name: string;
  timezone: string;
  locale: string;
  status: string;
  created_at: Date;
};

function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    schemaName: row.schema_name,
    timezone: row.timezone,
    locale: row.locale,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

async function insertTenant(client: PoolClient, input: CreateTenantInput) {
  const id = randomUUID();
  const schemaName = createTenantSchemaName(id);

  const result = await client.query<TenantRow>(
    `insert into core.tenants (
       id,
       slug,
       display_name,
       schema_name,
       timezone,
       locale
     )
     values ($1, $2, $3, $4, $5, $6)
     returning id, slug, display_name, schema_name, timezone, locale, status, created_at`,
    [
      id,
      input.slug,
      input.displayName,
      schemaName,
      input.timezone,
      input.locale,
    ],
  );

  const tenant = result.rows[0];
  if (!tenant) {
    throw new Error("Tenant insert did not return a row");
  }

  await client.query(tenantSchemaSql(schemaName));
  await client.query(
    `insert into ${quoteIdentifier(schemaName)}.tenant_migrations (id)
     values ($1)
     on conflict (id) do nothing`,
    ["001_tenant_base"],
  );

  return mapTenant(tenant);
}

export async function createTenant(input: CreateTenantInput) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const tenant = await insertTenant(client, input);
    await client.query("commit");
    return tenant;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listTenants() {
  const result = await pool.query<TenantRow>(
    `select id, slug, display_name, schema_name, timezone, locale, status, created_at
     from core.tenants
     order by created_at desc`,
  );

  return result.rows.map(mapTenant);
}
