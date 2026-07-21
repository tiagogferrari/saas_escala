import {
  auditActions,
  recordAuditEvent,
  systemAuditActor,
  type AuditActor,
} from "../audit/audit.repository";
import { pool } from "../../shared/db/pool";
import {
  ensureReplacementRequestAssignmentLink,
  findAssignmentById,
  hasOverlappingActiveAssignment,
} from "./assignment.helpers";
import {
  MemberScheduleError,
  ScheduleAssignmentError,
} from "./schedule.errors";
import type { CreateScheduleAssignmentInput } from "./schedule.types";
import { listMemberSchedules } from "./schedule-query.service";

export {
  MemberScheduleError,
  ScheduleAssignmentError,
} from "./schedule.errors";
export async function createScheduleAssignment(
  schema: string,
  scheduleId: string,
  input: CreateScheduleAssignmentInput,
  actor: AuditActor = systemAuditActor,
) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await ensureReplacementRequestAssignmentLink(client, schema);

    const personResult = await client.query<{ id: string }>(
      `select id
       from ${schema}.people
       where id = $1 and status = 'active'
       limit 1`,
      [input.personId],
    );

    if (!personResult.rows[0]) {
      throw new ScheduleAssignmentError(
        "person_not_found",
        "Person not found.",
      );
    }

    const slotResult = await client.query<{
      id: string;
      required_count: number;
      schedule_id: string;
      schedule_status: string;
      starts_at: Date;
      ends_at: Date;
    }>(
      `select
         ss.id,
         ss.required_count,
         s.id as schedule_id,
         s.starts_at,
         s.ends_at,
         s.status as schedule_status
       from ${schema}.schedules s
       join ${schema}.schedule_slots ss on ss.schedule_id = s.id
       where s.id = $1
       order by ss.created_at asc
       limit 1
       for update of s, ss`,
      [scheduleId],
    );

    const slot = slotResult.rows[0];
    if (!slot) {
      throw new ScheduleAssignmentError(
        "schedule_not_found",
        "Schedule not found.",
      );
    }

    if (!["draft", "published"].includes(slot.schedule_status)) {
      throw new ScheduleAssignmentError(
        "schedule_not_assignable",
        "Schedule cannot receive assignments.",
      );
    }

    const duplicateResult = await client.query<{ id: string }>(
      `select id
       from ${schema}.assignments
       where schedule_slot_id = $1
         and assignee_type = 'person'
         and assignee_id = $2
         and status <> 'cancelled'
       limit 1`,
      [slot.id, input.personId],
    );

    if (duplicateResult.rows[0]) {
      throw new ScheduleAssignmentError(
        "assignment_already_exists",
        "Person is already assigned to this schedule.",
      );
    }

    const hasTimeConflict = await hasOverlappingActiveAssignment(
      client,
      schema,
      input.personId,
      slot.starts_at,
      slot.ends_at,
      slot.schedule_id,
    );

    if (hasTimeConflict) {
      throw new ScheduleAssignmentError(
        "person_unavailable",
        "Person already has an active assignment in this time window.",
      );
    }

    const activeCountResult = await client.query<{ active_count: string }>(
      `select count(*) as active_count
       from ${schema}.assignments a
       left join ${schema}.replacement_requests linked_rr
         on linked_rr.id = a.replacement_request_id
       where a.schedule_slot_id = $1
         and a.status in (
           'invited',
           'pending',
           'confirmed',
           'externally_confirmed'
         )
         and (
           a.replacement_request_id is null
           or linked_rr.status = 'completed'
         )`,
      [slot.id],
    );

    const activeCount = Number(activeCountResult.rows[0]?.active_count ?? 0);
    if (activeCount >= slot.required_count) {
      throw new ScheduleAssignmentError(
        "slot_full",
        "Schedule slot is already full.",
      );
    }

    const isExternallyConfirmed = input.status === "externally_confirmed";
    const assignmentResult = await client.query<{ id: string }>(
      `insert into ${schema}.assignments (
        schedule_slot_id,
        assignee_type,
        assignee_id,
        status,
        confirmed_at,
        confirmation_source
      )
      values ($1, 'person', $2, $3, $4, $5)
      returning id`,
      [
        slot.id,
        input.personId,
        input.status,
        isExternallyConfirmed ? new Date().toISOString() : null,
        isExternallyConfirmed ? "manager" : null,
      ],
    );

    const assignment = assignmentResult.rows[0];
    if (!assignment) {
      throw new Error("Assignment insert did not return a row");
    }

    const mappedAssignment = await findAssignmentById(
      client,
      schema,
      assignment.id,
    );

    await recordAuditEvent(client, schema, {
      actor,
      action: auditActions.assignmentCreated,
      entityType: "schedule",
      entityId: scheduleId,
      context: {
        assignmentId: assignment.id,
        personId: input.personId,
        status: input.status,
        scheduleSlotId: slot.id,
      },
    });

    await client.query("commit");
    return mappedAssignment;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function respondToMemberScheduleAssignment(
  schema: string,
  personId: string,
  assignmentId: string,
  status: "confirmed" | "declined",
  actor: AuditActor = { type: "member", personId },
) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await ensureReplacementRequestAssignmentLink(client, schema);

    const assignmentResult = await client.query<{
      id: string;
      replacement_request_id: string | null;
      schedule_id: string;
      schedule_slot_id: string;
      status: string;
    }>(
      `select
         a.id,
         a.replacement_request_id,
         a.schedule_slot_id,
         a.status,
         s.id as schedule_id
       from ${schema}.assignments a
       join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
       join ${schema}.schedules s on s.id = ss.schedule_id
       where a.id = $1
         and a.assignee_type = 'person'
         and a.assignee_id = $2
         and s.status = 'published'
       limit 1`,
      [assignmentId, personId],
    );

    const assignment = assignmentResult.rows[0];
    if (!assignment) {
      throw new MemberScheduleError(
        "assignment_not_found",
        "Assignment not found.",
      );
    }

    if (
      !["invited", "pending", "confirmed", "declined"].includes(
        assignment.status,
      )
    ) {
      throw new MemberScheduleError(
        "assignment_not_actionable",
        "Assignment cannot be answered by the member.",
      );
    }

    await client.query(
      `update ${schema}.assignments
       set status = $1,
           confirmed_at = $2,
           confirmation_source = $3,
           updated_at = now()
       where id = $4`,
      [
        status,
        status === "confirmed" ? new Date().toISOString() : null,
        status === "confirmed" ? "member" : null,
        assignmentId,
      ],
    );

    if (assignment.replacement_request_id && status === "confirmed") {
      await client.query(
        `update ${schema}.replacement_requests
         set status = 'accepted',
             updated_at = now()
         where id = $1
           and status = 'waiting_response'`,
        [assignment.replacement_request_id],
      );
    }

    if (assignment.replacement_request_id && status === "declined") {
      await client.query(
        `update ${schema}.replacement_requests
         set status = 'requested',
             updated_at = now()
         where id = $1
           and status = 'waiting_response'`,
        [assignment.replacement_request_id],
      );
    }

    await recordAuditEvent(client, schema, {
      actor,
      action: auditActions.assignmentResponded,
      entityType: "schedule",
      entityId: assignment.schedule_id,
      context: {
        assignmentId,
        personId,
        previousStatus: assignment.status,
        status,
        replacementRequestId: assignment.replacement_request_id,
      },
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return listMemberSchedules(schema, personId);
}
