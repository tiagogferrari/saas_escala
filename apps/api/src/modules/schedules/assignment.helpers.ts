import type { PoolClient } from "pg";
import { pool } from "../../shared/db/pool";
import { mapScheduleAssignment } from "./schedule.mappers";
import type { ScheduleAssignmentRow } from "./schedule.rows";
import {
  assignmentSummarySelect,
  notificationDeliveryJoin,
  replacementRequestJoin,
} from "./schedule.sql";
import type { ScheduleAssignment, ScheduleDraft } from "./schedule.types";

export async function ensureReplacementRequestAssignmentLink(
  client: PoolClient,
  schema: string,
) {
  await client.query(`
    alter table ${schema}.assignments
      add column if not exists replacement_request_id uuid references ${schema}.replacement_requests (id)
  `);

  await client.query(`
    create index if not exists assignments_replacement_request_idx
      on ${schema}.assignments (replacement_request_id)
  `);
}

export async function hasOverlappingActiveAssignment(
  client: PoolClient,
  schema: string,
  personId: string,
  startsAt: Date,
  endsAt: Date,
  excludedScheduleId: string | null,
) {
  const result = await client.query<{ id: string }>(
    `select a.id
     from ${schema}.assignments a
     join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
     join ${schema}.schedules s on s.id = ss.schedule_id
     where a.assignee_type = 'person'
       and a.assignee_id = $1
       and a.status in ('invited', 'pending', 'confirmed', 'externally_confirmed')
       and s.status in ('draft', 'published')
       and ($4::uuid is null or s.id <> $4)
       and s.starts_at < $3
       and s.ends_at > $2
     limit 1`,
    [personId, startsAt, endsAt, excludedScheduleId],
  );

  return Boolean(result.rows[0]);
}

export async function listAssignmentsBySlotIds(
  schema: string,
  slotIds: string[],
) {
  const assignmentsBySlot = new Map<string, ScheduleAssignment[]>();

  if (slotIds.length === 0) {
    return assignmentsBySlot;
  }

  const result = await pool.query<ScheduleAssignmentRow>(
    `${assignmentSummarySelect}
     from ${schema}.assignments a
     left join ${schema}.people p
       on a.assignee_type = 'person' and p.id = a.assignee_id
     left join ${schema}.groups g
       on a.assignee_type = 'group' and g.id = a.assignee_id
     ${replacementRequestJoin(schema)}
     ${notificationDeliveryJoin(schema)}
     where a.schedule_slot_id = any($1::uuid[])
     order by a.created_at asc`,
    [slotIds],
  );

  for (const row of result.rows) {
    const assignment = mapScheduleAssignment(row);
    const currentAssignments =
      assignmentsBySlot.get(row.schedule_slot_id) ?? [];
    currentAssignments.push(assignment);
    assignmentsBySlot.set(row.schedule_slot_id, currentAssignments);
  }

  return assignmentsBySlot;
}

export async function findAssignmentById(
  client: PoolClient,
  schema: string,
  assignmentId: string,
) {
  const result = await client.query<ScheduleAssignmentRow>(
    `${assignmentSummarySelect}
     from ${schema}.assignments a
     left join ${schema}.people p
       on a.assignee_type = 'person' and p.id = a.assignee_id
     left join ${schema}.groups g
       on a.assignee_type = 'group' and g.id = a.assignee_id
     ${replacementRequestJoin(schema)}
     ${notificationDeliveryJoin(schema)}
     where a.id = $1
     limit 1`,
    [assignmentId],
  );

  const assignment = result.rows[0];
  if (!assignment) {
    throw new Error("Assignment query did not return a row");
  }

  return mapScheduleAssignment(assignment);
}

export async function attachAssignmentsToSchedules(
  schema: string,
  schedules: ScheduleDraft[],
) {
  const assignmentsBySlot = await listAssignmentsBySlotIds(
    schema,
    schedules.map((schedule) => schedule.slot.id),
  );

  return schedules.map((schedule) => ({
    ...schedule,
    assignments: assignmentsBySlot.get(schedule.slot.id) ?? [],
  }));
}
