import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool";
import {
  insertTenant,
  listTenantsForInitialSetup,
} from "../tenants/tenant-repository";
import {
  createSession,
  findUserCredentialsByEmail,
  hasGlobalUsers,
  revokeSession,
} from "./auth-repository";
import {
  clearSessionCookie,
  requireManagerSession,
  setSessionCookie,
} from "./auth-context";
import { hashPassword, normalizeEmail, verifyPassword } from "./passwords";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(12).max(128),
});

const setupSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(120),
  tenantSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(60),
  tenantDisplayName: z.string().trim().min(2).max(120).optional(),
});

const isProduction = process.env.NODE_ENV === "production";

async function createFirstManager(input: z.infer<typeof setupSchema>) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [61440524]);

    const existingUsers = await client.query<{ exists: boolean }>(
      "select exists(select 1 from core.global_users) as exists",
    );
    if (existingUsers.rows[0]?.exists) {
      await client.query("rollback");
      return { status: "unavailable" as const };
    }

    const tenantResult = await client.query<{ id: string }>(
      `select id
       from core.tenants
       where slug = $1 and status = 'active'
       limit 1`,
      [input.tenantSlug],
    );
    let tenant = tenantResult.rows[0];
    if (!tenant && !input.tenantDisplayName) {
      await client.query("rollback");
      return { status: "tenant_not_found" as const };
    }

    if (!tenant) {
      const createdTenant = await insertTenant(client, {
        slug: input.tenantSlug,
        displayName: input.tenantDisplayName ?? input.tenantSlug,
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
      });
      tenant = { id: createdTenant.id };
    }

    const userResult = await client.query<{
      id: string;
      display_name: string;
      email: string;
    }>(
      `insert into core.global_users (display_name, email, password_hash)
       values ($1, $2, $3)
       returning id, display_name, email`,
      [
        input.displayName,
        normalizeEmail(input.email),
        await hashPassword(input.password),
      ],
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new Error("First manager insert did not return a user");
    }

    await client.query(
      `insert into core.tenant_user_memberships (tenant_id, user_id, role)
       values ($1, $2, 'tenant_admin')`,
      [tenant.id, user.id],
    );
    await client.query("commit");

    return {
      status: "created" as const,
      user: {
        id: user.id,
        displayName: user.display_name,
        email: user.email,
      },
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/setup-status", async () => {
    const needsSetup = !(await hasGlobalUsers());

    return {
      data: {
        needsSetup,
        tenants: needsSetup ? await listTenantsForInitialSetup() : [],
      },
    };
  });

  app.post("/auth/setup", async (request, reply) => {
    const input = setupSchema.parse(request.body);
    const result = await createFirstManager(input);

    if (result.status === "unavailable") {
      return reply.code(409).send({
        error: "initial_setup_unavailable",
        message: "Initial setup has already been completed.",
      });
    }

    if (result.status === "tenant_not_found") {
      return reply.code(404).send({
        error: "tenant_not_found",
        message: "Tenant not found.",
      });
    }

    const session = await createSession(result.user.id);
    setSessionCookie(reply, session.token, session.expiresAt, isProduction);

    return reply.code(201).send({ data: { user: result.user } });
  });

  app.post("/auth/login", async (request, reply) => {
    const input = credentialsSchema.parse(request.body);
    const user = await findUserCredentialsByEmail(input.email);

    if (
      !user ||
      user.status !== "active" ||
      !user.passwordHash ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      return reply.code(401).send({
        error: "invalid_credentials",
        message: "Invalid email or password.",
      });
    }

    const session = await createSession(user.id);
    setSessionCookie(reply, session.token, session.expiresAt, isProduction);

    return {
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
        },
      },
    };
  });

  app.get("/auth/me", async (request, reply) => {
    const user = await requireManagerSession(request, reply);
    if (!user) {
      return;
    }

    const tenants = await pool.query<{
      id: string;
      slug: string;
      display_name: string;
      schema_name: string;
      timezone: string;
      locale: string;
      status: string;
      created_at: Date;
    }>(
      `select t.id, t.slug, t.display_name, t.schema_name, t.timezone, t.locale,
              t.status, t.created_at
       from core.tenants t
       join core.tenant_user_memberships membership
         on membership.tenant_id = t.id
       where membership.user_id = $1
         and t.status = 'active'
       order by t.created_at desc`,
      [user.id],
    );

    return {
      data: {
        user,
        tenants: tenants.rows.map((tenant) => ({
          id: tenant.id,
          slug: tenant.slug,
          displayName: tenant.display_name,
          schemaName: tenant.schema_name,
          timezone: tenant.timezone,
          locale: tenant.locale,
          status: tenant.status,
          createdAt: tenant.created_at.toISOString(),
        })),
      },
    };
  });

  app.post("/auth/logout", async (request, reply) => {
    const cookieHeader = request.headers.cookie ?? "";
    const token = cookieHeader
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith("escala_session="))
      ?.slice("escala_session=".length);

    if (token) {
      await revokeSession(decodeURIComponent(token));
    }

    clearSessionCookie(reply, isProduction);
    return reply.code(204).send();
  });
}
