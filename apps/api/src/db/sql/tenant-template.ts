import { quoteIdentifier } from "../identifiers";

export function tenantSchemaSql(schemaName: string) {
  const schema = quoteIdentifier(schemaName);

  return `
CREATE SCHEMA IF NOT EXISTS ${schema};

CREATE TABLE IF NOT EXISTS ${schema}.tenant_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${schema}.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_user_id uuid,
  display_name text NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  paused_until date,
  private_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT people_status_check CHECK (status IN ('active', 'paused', 'inactive'))
);

CREATE INDEX IF NOT EXISTS people_status_idx ON ${schema}.people (status);
CREATE INDEX IF NOT EXISTS people_global_user_idx ON ${schema}.people (global_user_id);

CREATE TABLE IF NOT EXISTS ${schema}.member_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES ${schema}.people (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_access_tokens_person_idx
  ON ${schema}.member_access_tokens (person_id);

CREATE TABLE IF NOT EXISTS ${schema}.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${schema}.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid REFERENCES ${schema}.regions (id),
  name text NOT NULL,
  address text,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${schema}.functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${schema}.schedule_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  location_id uuid NOT NULL REFERENCES ${schema}.locations (id),
  function_id uuid NOT NULL REFERENCES ${schema}.functions (id),
  anchor_starts_at timestamptz NOT NULL,
  anchor_ends_at timestamptz NOT NULL,
  recurrence_interval_weeks integer NOT NULL,
  recurrence_ends_on date NOT NULL,
  required_count integer NOT NULL DEFAULT 1,
  meeting_point text,
  instructions text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_series_interval_check CHECK (recurrence_interval_weeks > 0),
  CONSTRAINT schedule_series_required_count_check CHECK (required_count > 0),
  CONSTRAINT schedule_series_range_check CHECK (anchor_starts_at < anchor_ends_at),
  CONSTRAINT schedule_series_status_check CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS schedule_series_status_idx
  ON ${schema}.schedule_series (status, recurrence_ends_on);

CREATE TABLE IF NOT EXISTS ${schema}.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT groups_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS ${schema}.group_memberships (
  group_id uuid NOT NULL REFERENCES ${schema}.groups (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES ${schema}.people (id),
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, person_id, starts_on),
  CONSTRAINT group_memberships_date_check CHECK (ends_on IS NULL OR starts_on <= ends_on)
);

CREATE TABLE IF NOT EXISTS ${schema}.function_eligibilities (
  function_id uuid NOT NULL REFERENCES ${schema}.functions (id) ON DELETE CASCADE,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (function_id, subject_type, subject_id),
  CONSTRAINT function_eligibilities_subject_check CHECK (subject_type IN ('person', 'group'))
);

CREATE TABLE IF NOT EXISTS ${schema}.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES ${schema}.locations (id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  meeting_point text,
  instructions text,
  reference_contact text,
  cancelled_reason text,
  published_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedules_status_check CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  CONSTRAINT schedules_range_check CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS schedules_time_idx ON ${schema}.schedules (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS schedules_status_idx ON ${schema}.schedules (status);

ALTER TABLE ${schema}.schedules
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES ${schema}.schedule_series (id);

ALTER TABLE ${schema}.schedules
  ADD COLUMN IF NOT EXISTS series_occurrence_date date;

CREATE INDEX IF NOT EXISTS schedules_series_occurrence_idx
  ON ${schema}.schedules (series_id, series_occurrence_date);

CREATE TABLE IF NOT EXISTS ${schema}.schedule_series_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES ${schema}.schedule_series (id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  exception_type text NOT NULL DEFAULT 'skipped',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_series_exceptions_type_check CHECK (
    exception_type IN ('skipped')
  ),
  UNIQUE (series_id, occurrence_date)
);

CREATE TABLE IF NOT EXISTS ${schema}.schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES ${schema}.schedules (id) ON DELETE CASCADE,
  function_id uuid NOT NULL REFERENCES ${schema}.functions (id),
  required_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_slots_required_count_check CHECK (required_count > 0)
);

CREATE TABLE IF NOT EXISTS ${schema}.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_slot_id uuid NOT NULL REFERENCES ${schema}.schedule_slots (id) ON DELETE CASCADE,
  assignee_type text NOT NULL,
  assignee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  response_due_at timestamptz,
  confirmed_at timestamptz,
  confirmation_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_assignee_type_check CHECK (assignee_type IN ('person', 'group')),
  CONSTRAINT assignments_status_check CHECK (
    status IN ('invited', 'pending', 'confirmed', 'externally_confirmed', 'declined', 'expired', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS assignments_slot_idx ON ${schema}.assignments (schedule_slot_id);
CREATE INDEX IF NOT EXISTS assignments_assignee_idx ON ${schema}.assignments (assignee_type, assignee_id);

CREATE TABLE IF NOT EXISTS ${schema}.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES ${schema}.assignments (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES ${schema}.people (id) ON DELETE CASCADE,
  kind text NOT NULL,
  delivery_key text UNIQUE,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_kind_check CHECK (
    kind IN ('schedule_invitation', 'schedule_reminder_24h')
  ),
  CONSTRAINT notification_deliveries_status_check CHECK (
    status IN ('queued', 'sent', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS notification_deliveries_assignment_idx
  ON ${schema}.notification_deliveries (assignment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx
  ON ${schema}.notification_deliveries (status, created_at);

CREATE TABLE IF NOT EXISTS ${schema}.replacement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES ${schema}.assignments (id),
  requested_by_person_id uuid NOT NULL REFERENCES ${schema}.people (id),
  status text NOT NULL DEFAULT 'requested',
  reason text,
  urgent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT replacement_requests_status_check CHECK (
    status IN ('requested', 'under_review', 'waiting_response', 'accepted', 'declined', 'expired', 'cancelled', 'completed')
  )
);

ALTER TABLE ${schema}.assignments
  ADD COLUMN IF NOT EXISTS replacement_request_id uuid REFERENCES ${schema}.replacement_requests (id);

CREATE INDEX IF NOT EXISTS assignments_replacement_request_idx
  ON ${schema}.assignments (replacement_request_id);

CREATE TABLE IF NOT EXISTS ${schema}.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES ${schema}.assignments (id),
  status text NOT NULL DEFAULT 'not_recorded',
  notes text,
  recorded_by_person_id uuid REFERENCES ${schema}.people (id),
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_status_check CHECK (
    status IN ('not_recorded', 'attended', 'missed', 'excused_or_cancelled')
  )
);

CREATE TABLE IF NOT EXISTS ${schema}.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_person_id uuid REFERENCES ${schema}.people (id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ${schema}.functions (name, description, is_default)
VALUES ('Abertura', 'Responsavel pela abertura do local ou atividade.', true)
ON CONFLICT DO NOTHING;
`;
}
