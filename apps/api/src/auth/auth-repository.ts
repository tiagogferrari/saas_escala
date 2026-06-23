import { createHash, randomBytes } from "node:crypto";
import { pool } from "../db/pool";
import { normalizeEmail } from "./passwords";

const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export type AuthenticatedUser = {
  id: string;
  displayName: string;
  email: string;
};

export type UserCredentials = AuthenticatedUser & {
  passwordHash: string | null;
  status: string;
};

type UserRow = {
  id: string;
  display_name: string;
  email: string;
  password_hash: string | null;
  status: string;
};

type SessionUserRow = UserRow & {
  session_id: string;
};

function mapUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
  };
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function getSessionExpiresAt() {
  return new Date(Date.now() + sessionLifetimeMs);
}

export async function hasGlobalUsers() {
  const result = await pool.query<{ exists: boolean }>(
    "select exists(select 1 from core.global_users) as exists",
  );

  return result.rows[0]?.exists ?? false;
}

export async function findUserCredentialsByEmail(email: string) {
  const result = await pool.query<UserRow>(
    `select id, display_name, email, password_hash, status
     from core.global_users
     where email = $1
     limit 1`,
    [normalizeEmail(email)],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    ...mapUser(row),
    passwordHash: row.password_hash,
    status: row.status,
  } satisfies UserCredentials;
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = getSessionExpiresAt();

  await pool.query(
    `insert into core.auth_sessions (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, hashSessionToken(token), expiresAt],
  );

  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string) {
  const result = await pool.query<SessionUserRow>(
    `select
       u.id,
       u.display_name,
       u.email,
       u.password_hash,
       u.status,
       s.id as session_id
     from core.auth_sessions s
     join core.global_users u on u.id = s.user_id
     where s.token_hash = $1
       and s.revoked_at is null
       and s.expires_at > now()
       and u.status = 'active'
     limit 1`,
    [hashSessionToken(token)],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  await pool.query(
    "update core.auth_sessions set last_used_at = now() where id = $1",
    [row.session_id],
  );

  return mapUser(row);
}

export async function revokeSession(token: string) {
  await pool.query(
    `update core.auth_sessions
     set revoked_at = now()
     where token_hash = $1
       and revoked_at is null`,
    [hashSessionToken(token)],
  );
}

export async function userCanManageTenant(userId: string, tenantSlug: string) {
  const result = await pool.query<{ allowed: boolean }>(
    `select exists(
       select 1
       from core.tenant_user_memberships membership
       join core.tenants tenant on tenant.id = membership.tenant_id
       where membership.user_id = $1
         and tenant.slug = $2
         and tenant.status = 'active'
         and membership.role in (
           'platform_admin',
           'tenant_admin',
           'regional_manager',
           'local_manager'
         )
     ) as allowed`,
    [userId, tenantSlug],
  );

  return result.rows[0]?.allowed ?? false;
}
