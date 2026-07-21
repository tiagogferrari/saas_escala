import { pool } from "../db/pool";
import {
  insertTenant,
  listTenantsForInitialSetup,
  listTenantsForUser,
} from "../../modules/tenants/tenants.repository";
import {
  createSession,
  findUserCredentialsByEmail,
  hasGlobalUsers,
} from "./auth.repository";
import type { SetupInput } from "./auth.schemas";
import type { AuthenticatedUser } from "./auth.types";
import { hashPassword, normalizeEmail, verifyPassword } from "./passwords";

export async function getInitialSetupStatus() {
  const needsSetup = !(await hasGlobalUsers());

  return {
    needsSetup,
    tenants: needsSetup ? await listTenantsForInitialSetup() : [],
  };
}

export async function createFirstManager(input: SetupInput) {
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

export async function createManagerSession(email: string, password: string) {
  const user = await findUserCredentialsByEmail(email);

  if (
    !user ||
    user.status !== "active" ||
    !user.passwordHash ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    return null;
  }

  return {
    session: await createSession(user.id),
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
    },
  };
}

export async function getManagerProfile(user: AuthenticatedUser) {
  return {
    user,
    tenants: await listTenantsForUser(user.id),
  };
}
