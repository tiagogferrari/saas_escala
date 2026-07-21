import { pool } from "../../shared/db/pool";
import {
  attachAssignmentsToSchedules,
  listAssignmentsBySlotIds,
} from "./assignment.helpers";
import {
  MemberScheduleError,
  ScheduleAssignmentError,
  SchedulePublicationError,
} from "./schedule.errors";
import { mapMemberSchedule, mapScheduleDraft } from "./schedule.mappers";
import type { MemberScheduleRow, ScheduleDraftRow } from "./schedule.rows";
import { replacementRequestJoin, scheduleSummarySelect } from "./schedule.sql";

export {
  MemberScheduleError,
  ScheduleAssignmentError,
  SchedulePublicationError,
} from "./schedule.errors";
export async function listScheduleDrafts(schema: string) {
  const result = await pool.query<ScheduleDraftRow>(
    `${scheduleSummarySelect}
     from ${schema}.schedules s
     join ${schema}.locations l on l.id = s.location_id
     join ${schema}.schedule_slots ss on ss.schedule_id = s.id
     join ${schema}.functions f on f.id = ss.function_id
     order by s.starts_at asc, s.created_at asc
     limit 100`,
  );

  return attachAssignmentsToSchedules(
    schema,
    result.rows.map(mapScheduleDraft),
  );
}

export async function listMemberSchedules(schema: string, personId: string) {
  const personResult = await pool.query<{ id: string }>(
    `select id
     from ${schema}.people
     where id = $1 and status = 'active'
     limit 1`,
    [personId],
  );

  if (!personResult.rows[0]) {
    throw new MemberScheduleError("person_not_found", "Person not found.");
  }

  const result = await pool.query<MemberScheduleRow>(
    `select
       a.id as assignment_id,
       a.status as assignment_status,
       a.confirmed_at as assignment_confirmed_at,
       a.confirmation_source as assignment_confirmation_source,
       a.created_at as assignment_created_at,
       a.replacement_request_id as linked_replacement_request_id,
       a.assignee_id,
       p.display_name as assignee_name,
       s.id as schedule_id,
       s.title,
       s.status as schedule_status,
       s.starts_at,
       s.ends_at,
       s.cancelled_reason,
       s.cancelled_at,
       l.id as location_id,
       l.name as location_name,
       ss.id as slot_id,
       f.id as function_id,
       f.name as function_name,
       ss.required_count,
       rr.id as replacement_request_id,
       rr.requested_by_person_id as replacement_requested_by_person_id,
       rr.status as replacement_request_status,
       rr.reason as replacement_request_reason,
       rr.urgent as replacement_request_urgent,
       rr.created_at as replacement_request_created_at,
       rr.updated_at as replacement_request_updated_at
     from ${schema}.assignments a
     join ${schema}.people p on p.id = a.assignee_id
     join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
     join ${schema}.schedules s on s.id = ss.schedule_id
     join ${schema}.locations l on l.id = s.location_id
     join ${schema}.functions f on f.id = ss.function_id
     ${replacementRequestJoin(schema)}
     where a.assignee_type = 'person'
       and a.assignee_id = $1
       and (
         (s.status = 'published' and a.status <> 'cancelled')
         or (s.status = 'cancelled' and a.status = 'cancelled')
       )
     order by s.starts_at asc, s.created_at asc`,
    [personId],
  );

  const assignmentsBySlot = await listAssignmentsBySlotIds(
    schema,
    result.rows.map((row) => row.slot_id),
  );

  return result.rows.map((row) => {
    const isScheduleCancelled = row.schedule_status === "cancelled";
    const companions = (assignmentsBySlot.get(row.slot_id) ?? []).filter(
      (assignment) =>
        assignment.id !== row.assignment_id &&
        assignment.status !== "declined" &&
        (isScheduleCancelled || assignment.status !== "cancelled"),
    );

    return mapMemberSchedule(row, companions);
  });
}

export async function getScheduleDraftById(schema: string, scheduleId: string) {
  const result = await pool.query<ScheduleDraftRow>(
    `${scheduleSummarySelect}
     from ${schema}.schedules s
     join ${schema}.locations l on l.id = s.location_id
     join ${schema}.schedule_slots ss on ss.schedule_id = s.id
     join ${schema}.functions f on f.id = ss.function_id
     where s.id = $1
     order by ss.created_at asc
     limit 1`,
    [scheduleId],
  );

  const schedule = result.rows[0];
  if (!schedule) {
    throw new SchedulePublicationError(
      "schedule_not_found",
      "Schedule not found.",
    );
  }

  const [scheduleWithAssignments] = await attachAssignmentsToSchedules(schema, [
    mapScheduleDraft(schedule),
  ]);

  if (!scheduleWithAssignments) {
    throw new Error("Schedule query did not return a mapped schedule");
  }

  return scheduleWithAssignments;
}

export async function listScheduleAssignments(
  schema: string,
  scheduleId: string,
) {
  const slotsResult = await pool.query<{ id: string }>(
    `select id
     from ${schema}.schedule_slots
     where schedule_id = $1
     order by created_at asc`,
    [scheduleId],
  );

  if (slotsResult.rows.length === 0) {
    throw new ScheduleAssignmentError(
      "schedule_not_found",
      "Schedule not found.",
    );
  }

  const slotIds = slotsResult.rows.map((row) => row.id);
  const assignmentsBySlot = await listAssignmentsBySlotIds(schema, slotIds);

  return slotIds.flatMap((slotId) => assignmentsBySlot.get(slotId) ?? []);
}
