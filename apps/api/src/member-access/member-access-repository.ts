import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db/pool";

export type MemberAccessPerson = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

export type MemberAccessToken = {
  token: string;
  expiresAt: string;
  person: MemberAccessPerson;
};

type MemberAccessPersonRow = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: Date;
};

type MemberAccessErrorCode = "access_token_invalid" | "person_not_found";

export class MemberAccessError extends Error {
  constructor(
    public readonly code: MemberAccessErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function mapPerson(row: MemberAccessPersonRow): MemberAccessPerson {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureMemberAccessTokensTable(
  client: PoolClient,
  schema: string,
) {
  await client.query(`
    create table if not exists ${schema}.member_access_tokens (
      id uuid primary key default gen_random_uuid(),
      person_id uuid not null references ${schema}.people (id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create index if not exists member_access_tokens_person_idx
      on ${schema}.member_access_tokens (person_id)
  `);
}

export async function createMemberAccessToken(
  schema: string,
  personId: string,
) {
  const client = await pool.connect();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  try {
    await client.query("begin");
    await ensureMemberAccessTokensTable(client, schema);

    const personResult = await client.query<MemberAccessPersonRow>(
      `select id, display_name, email, phone, status, created_at
       from ${schema}.people
       where id = $1 and status = 'active'
       limit 1`,
      [personId],
    );

    const person = personResult.rows[0];
    if (!person) {
      throw new MemberAccessError("person_not_found", "Person not found.");
    }

    await client.query(
      `insert into ${schema}.member_access_tokens (
        person_id,
        token_hash,
        expires_at
      )
      values ($1, $2, $3)`,
      [personId, hashToken(token), expiresAt.toISOString()],
    );

    await client.query("commit");

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      person: mapPerson(person),
    } satisfies MemberAccessToken;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function validateMemberAccessToken(schema: string, token: string) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await ensureMemberAccessTokensTable(client, schema);

    const personResult = await client.query<
      MemberAccessPersonRow & {
        token_id: string;
      }
    >(
      `select
         mat.id as token_id,
         p.id,
         p.display_name,
         p.email,
         p.phone,
         p.status,
         p.created_at
       from ${schema}.member_access_tokens mat
       join ${schema}.people p on p.id = mat.person_id
       where mat.token_hash = $1
         and mat.revoked_at is null
         and mat.expires_at > now()
         and p.status = 'active'
       limit 1`,
      [hashToken(token)],
    );

    const person = personResult.rows[0];
    if (!person) {
      throw new MemberAccessError(
        "access_token_invalid",
        "Member access token is invalid.",
      );
    }

    await client.query(
      `update ${schema}.member_access_tokens
       set last_used_at = now()
       where id = $1`,
      [person.token_id],
    );

    await client.query("commit");

    return mapPerson(person);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
