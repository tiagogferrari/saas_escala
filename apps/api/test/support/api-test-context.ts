import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app";
import { createSession } from "../../src/shared/auth/auth.repository";
import { quoteIdentifier } from "../../src/shared/db/identifiers";
import { pool } from "../../src/shared/db/pool";
import {
  insertTenant,
  type Tenant,
} from "../../src/modules/tenants/tenants.repository";

export type ApiTestContext = {
  app: FastifyInstance;
  managerUserId: string;
  sessionCookie: string;
  tenant: Tenant;
};

export type ApiTestResponse = {
  json: () => unknown;
  payload: string;
  statusCode: number;
};

export type EntityResponse<T> = {
  data: T;
};

async function createTestContext() {
  const app = await buildApp({
    logger: false,
    startSchedulers: false,
  });
  const testId = randomUUID();
  const slug = `test-${testId.slice(0, 8)}`;
  const client = await pool.connect();

  let managerUserId = "";
  let tenant: Tenant | null = null;

  try {
    await client.query("begin");
    const userResult = await client.query<{ id: string }>(
      `insert into core.global_users (email, display_name, password_hash)
       values ($1, $2, null)
       returning id`,
      [`manager-${testId}@example.test`, "Gestor Teste"],
    );

    managerUserId = userResult.rows[0]?.id ?? "";
    assert.ok(managerUserId, "manager user should be created");

    tenant = await insertTenant(client, {
      slug,
      displayName: `Tenant Teste ${testId.slice(0, 8)}`,
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
    });

    await client.query(
      `insert into core.tenant_user_memberships (tenant_id, user_id, role)
       values ($1, $2, 'tenant_admin')`,
      [tenant.id, managerUserId],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  assert.ok(tenant, "tenant should be created");
  const session = await createSession(managerUserId);
  await app.ready();

  return {
    app,
    managerUserId,
    sessionCookie: `escala_session=${encodeURIComponent(session.token)}`,
    tenant,
  } satisfies ApiTestContext;
}

async function cleanupTestContext(context: ApiTestContext | null) {
  if (!context) {
    return;
  }

  await context.app.close();
  await pool.query(
    `drop schema if exists ${quoteIdentifier(context.tenant.schemaName)} cascade`,
  );
  await pool.query("delete from core.auth_sessions where user_id = $1", [
    context.managerUserId,
  ]);
  await pool.query(
    "delete from core.tenant_user_memberships where tenant_id = $1 or user_id = $2",
    [context.tenant.id, context.managerUserId],
  );
  await pool.query("delete from core.tenants where id = $1", [
    context.tenant.id,
  ]);
  await pool.query("delete from core.global_users where id = $1", [
    context.managerUserId,
  ]);
}

export function apiScenario(
  name: string,
  run: (context: ApiTestContext) => Promise<void>,
) {
  test(name, async () => {
    let context: ApiTestContext | null = null;

    try {
      context = await createTestContext();
      await run(context);
    } finally {
      await cleanupTestContext(context);
    }
  });
}

export function closeDatabasePoolAfterTests() {
  after(async () => {
    await pool.end();
  });
}

export async function managerRequest(
  context: ApiTestContext,
  method: "GET" | "POST" | "PATCH",
  url: string,
  payload?: Record<string, unknown>,
) {
  const response = await context.app.inject({
    method,
    url,
    headers: {
      cookie: context.sessionCookie,
    },
    payload,
  });

  return response as unknown as ApiTestResponse;
}

export async function publicRequest(
  context: ApiTestContext,
  method: "GET" | "POST",
  url: string,
  payload?: Record<string, unknown>,
) {
  const response = await context.app.inject({
    method,
    url,
    payload,
  });

  return response as unknown as ApiTestResponse;
}

export function expectStatus(response: ApiTestResponse, statusCode: number) {
  assert.equal(response.statusCode, statusCode, response.payload);
}

export function responseJson<T>(response: ApiTestResponse) {
  return response.json() as T;
}
