CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.platform_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  schema_name text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  locale text NOT NULL DEFAULT 'pt-BR',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_status_check CHECK (
    status IN ('active', 'pending_deletion', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS tenants_status_idx ON core.tenants (status);

CREATE TABLE IF NOT EXISTS core.global_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT global_users_status_check CHECK (
    status IN ('active', 'disabled')
  )
);

CREATE TABLE IF NOT EXISTS core.tenant_user_memberships (
  tenant_id uuid NOT NULL REFERENCES core.tenants (id),
  user_id uuid NOT NULL REFERENCES core.global_users (id),
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id),
  CONSTRAINT tenant_user_memberships_role_check CHECK (
    role IN ('platform_admin', 'tenant_admin', 'regional_manager', 'local_manager', 'member')
  )
);

CREATE TABLE IF NOT EXISTS core.cross_tenant_busy_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES core.global_users (id),
  tenant_id uuid NOT NULL REFERENCES core.tenants (id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source_assignment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cross_tenant_busy_windows_range_check CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS cross_tenant_busy_windows_lookup_idx
  ON core.cross_tenant_busy_windows (user_id, starts_at, ends_at);
