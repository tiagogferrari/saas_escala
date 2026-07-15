import type { PoolClient } from "pg";
import { pool } from "../db/pool";

export type AuditActor =
  | {
      type: "manager";
      userId: string;
      displayName?: string;
    }
  | {
      type: "member";
      personId: string;
      displayName?: string;
    }
  | {
      type: "system";
      displayName?: string;
    };

export const systemAuditActor: AuditActor = { type: "system" };

export const auditActions = {
  assignmentCreated: "assignment.created",
  assignmentResponded: "assignment.responded",
  occurrenceRestored: "schedule_occurrence.restored",
  occurrenceSkipped: "schedule_occurrence.skipped",
  occurrenceUpdated: "schedule_occurrence.updated",
  replacementCandidateInvited: "replacement.candidate_invited",
  replacementCompleted: "replacement.completed",
  replacementRequested: "replacement.requested",
  scheduleCancelled: "schedule.cancelled",
  scheduleCreated: "schedule.created",
  schedulePublished: "schedule.published",
  seriesArchived: "schedule_series.archived",
  seriesCreated: "schedule_series.created",
  seriesUpdated: "schedule_series.updated",
} as const;

export type RecordAuditEventInput = {
  actor?: AuditActor;
  action: (typeof auditActions)[keyof typeof auditActions];
  entityType: "schedule" | "schedule_series";
  entityId: string;
  context?: Record<string, unknown>;
};

export type ListAuditEventsInput = {
  action?: string;
  entityType?: string;
  entityId?: string;
  before?: string;
  limit: number;
};

type AuditEventRow = {
  id: string;
  actor_type: AuditActor["type"];
  actor_user_id: string | null;
  actor_person_id: string | null;
  actor_display_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  context: Record<string, unknown>;
  created_at: Date;
};

export type AuditEvent = {
  id: string;
  actor: {
    type: AuditActor["type"];
    id: string | null;
    displayName: string;
  };
  action: string;
  entity: {
    type: string;
    id: string | null;
  };
  context: Record<string, unknown>;
  createdAt: string;
};

export async function recordAuditEvent(
  client: PoolClient,
  schema: string,
  input: RecordAuditEventInput,
) {
  const actor = input.actor ?? systemAuditActor;
  const actorUserId = actor.type === "manager" ? actor.userId : null;
  const actorPersonId = actor.type === "member" ? actor.personId : null;

  const result = await client.query<{ id: string }>(
    `insert into ${schema}.audit_events (
       actor_type,
       actor_user_id,
       actor_person_id,
       actor_label,
       action,
       entity_type,
       entity_id,
       context
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     returning id`,
    [
      actor.type,
      actorUserId,
      actorPersonId,
      actor.displayName ?? null,
      input.action,
      input.entityType,
      input.entityId,
      JSON.stringify(input.context ?? {}),
    ],
  );

  const event = result.rows[0];
  if (!event) {
    throw new Error("Audit event insert did not return a row");
  }

  return event.id;
}

export async function listAuditEvents(
  schema: string,
  input: ListAuditEventsInput,
) {
  const filters: string[] = [];
  const values: Array<string | number> = [];

  if (input.action) {
    values.push(input.action);
    filters.push(`ae.action = $${values.length}`);
  }

  if (input.entityType) {
    values.push(input.entityType);
    filters.push(`ae.entity_type = $${values.length}`);
  }

  if (input.entityId) {
    values.push(input.entityId);
    filters.push(`ae.entity_id = $${values.length}`);
  }

  if (input.before) {
    values.push(input.before);
    filters.push(`ae.created_at < $${values.length}::timestamptz`);
  }

  values.push(input.limit);
  const whereClause =
    filters.length > 0 ? `where ${filters.join(" and ")}` : "";
  const result = await pool.query<AuditEventRow>(
    `select
       ae.id,
       ae.actor_type,
       ae.actor_user_id,
       ae.actor_person_id,
       coalesce(
         ae.actor_label,
         manager.display_name,
         member.display_name,
         'Sistema'
       ) as actor_display_name,
       ae.action,
       ae.entity_type,
       ae.entity_id,
       ae.context,
       ae.created_at
     from ${schema}.audit_events ae
     left join core.global_users manager on manager.id = ae.actor_user_id
     left join ${schema}.people member on member.id = ae.actor_person_id
     ${whereClause}
     order by ae.created_at desc, ae.id desc
     limit $${values.length}`,
    values,
  );

  return result.rows.map(
    (row): AuditEvent => ({
      id: row.id,
      actor: {
        type: row.actor_type,
        id:
          row.actor_type === "manager"
            ? row.actor_user_id
            : row.actor_type === "member"
              ? row.actor_person_id
              : null,
        displayName: row.actor_display_name,
      },
      action: row.action,
      entity: {
        type: row.entity_type,
        id: row.entity_id,
      },
      context: row.context,
      createdAt: row.created_at.toISOString(),
    }),
  );
}
