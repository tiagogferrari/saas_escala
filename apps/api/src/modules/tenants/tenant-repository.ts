import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { createTenantSchemaName, quoteIdentifier } from "../../shared/db/identifiers";
import { pool } from "../../shared/db/pool";
import { tenantSchemaSql } from "../../shared/db/sql/tenant-template";

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

export async function insertTenant(
  client: PoolClient,
  input: CreateTenantInput,
) {
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

export async function createTenant(input: CreateTenantInput, userId: string) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const tenant = await insertTenant(client, input);
    await client.query(
      `insert into core.tenant_user_memberships (tenant_id, user_id, role)
       values ($1, $2, 'tenant_admin')`,
      [tenant.id, userId],
    );
    await client.query("commit");
    return tenant;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listTenantsForUser(userId: string) {
  const result = await pool.query<TenantRow>(
    `select id, slug, display_name, schema_name, timezone, locale, status, created_at
     from core.tenants tenant
     join core.tenant_user_memberships membership
       on membership.tenant_id = tenant.id
     where membership.user_id = $1
       and tenant.status = 'active'
     order by tenant.created_at desc`,
    [userId],
  );

  return result.rows.map(mapTenant);
}

export async function listTenantsForInitialSetup() {
  const result = await pool.query<Pick<TenantRow, "slug" | "display_name">>(
    `select slug, display_name
     from core.tenants
     where status = 'active'
     order by created_at asc`,
  );

  return result.rows.map((tenant) => ({
    slug: tenant.slug,
    displayName: tenant.display_name,
  }));
}

export async function listActiveTenants() {
  const result = await pool.query<TenantRow>(
    `select id, slug, display_name, schema_name, timezone, locale, status, created_at
     from core.tenants
     where status = 'active'
     order by created_at asc`,
  );

  return result.rows.map(mapTenant);
}

export async function getTenantBySlug(slug: string) {
  const result = await pool.query<TenantRow>(
    `select id, slug, display_name, schema_name, timezone, locale, status, created_at
     from core.tenants
     where slug = $1
     limit 1`,
    [slug],
  );

  const tenant = result.rows[0];
  return tenant ? mapTenant(tenant) : null;
}

