import {
  auditActions,
  recordAuditEvent,
  systemAuditActor,
  type AuditActor,
} from "../audit/audit.repository";
import { pool } from "../../shared/db/pool";
import {
  ensureReplacementRequestAssignmentLink,
  hasOverlappingActiveAssignment,
} from "./assignment.helpers";
import {
  MemberScheduleError,
  ReplacementRequestManagerError,
} from "./schedule.errors";
import type { CreateReplacementRequestInput } from "./schedule.types";
import {
  getScheduleDraftById,
  listMemberSchedules,
} from "./schedule-query.service";

export {
  MemberScheduleError,
  ReplacementRequestManagerError,
} from "./schedule.errors";
export async function inviteReplacementCandidate(
  schema: string,
  replacementRequestId: string,
  personId: string,
  actor: AuditActor = systemAuditActor,
) {
  const client = await pool.connect();
  let scheduleId = "";

  try {
    await client.query("begin");
    await ensureReplacementRequestAssignmentLink(client, schema);

    const personResult = await client.query<{ id: string }>(
      `select id
       from ${schema}.people
       where id = $1 and status = 'active'
       limit 1`,
      [personId],
    );

    if (!personResult.rows[0]) {
      throw new ReplacementRequestManagerError(
        "person_not_found",
        "Person not found.",
      );
    }

    const requestResult = await client.query<{
      assignment_id: string;
      ends_at: Date;
      schedule_id: string;
      schedule_slot_id: string;
      schedule_status: string;
      starts_at: Date;
      status: string;
    }>(
      `select
         rr.assignment_id,
         rr.status,
         a.schedule_slot_id,
         s.starts_at,
         s.ends_at,
         s.id as schedule_id,
         s.status as schedule_status
       from ${schema}.replacement_requests rr
       join ${schema}.assignments a on a.id = rr.assignment_id
       join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
       join ${schema}.schedules s on s.id = ss.schedule_id
       where rr.id = $1
       limit 1
       for update of rr, s, ss`,
      [replacementRequestId],
    );

    const replacementRequest = requestResult.rows[0];
    if (!replacementRequest) {
      throw new ReplacementRequestManagerError(
        "replacement_request_not_found",
        "Replacement request not found.",
      );
    }

    scheduleId = replacementRequest.schedule_id;

    if (!["requested", "under_review"].includes(replacementRequest.status)) {
      throw new ReplacementRequestManagerError(
        "replacement_request_not_open",
        "Replacement request is not open.",
      );
    }

    if (replacementRequest.schedule_status !== "published") {
      throw new ReplacementRequestManagerError(
        "schedule_not_assignable",
        "Schedule cannot receive replacement candidates.",
      );
    }

    const duplicateResult = await client.query<{ id: string }>(
      `select id
       from ${schema}.assignments
       where schedule_slot_id = $1
         and assignee_type = 'person'
         and assignee_id = $2
         and status not in ('cancelled', 'declined')
       limit 1`,
      [replacementRequest.schedule_slot_id, personId],
    );

    if (duplicateResult.rows[0]) {
      throw new ReplacementRequestManagerError(
        "assignment_already_exists",
        "Person is already assigned to this schedule.",
      );
    }

    const hasTimeConflict = await hasOverlappingActiveAssignment(
      client,
      schema,
      personId,
      replacementRequest.starts_at,
      replacementRequest.ends_at,
      replacementRequest.schedule_id,
    );

    if (hasTimeConflict) {
      throw new ReplacementRequestManagerError(
        "person_unavailable",
        "Person already has an active assignment in this time window.",
      );
    }

    const candidateAssignmentResult = await client.query<{ id: string }>(
      `insert into ${schema}.assignments (
        schedule_slot_id,
        assignee_type,
        assignee_id,
        status,
        replacement_request_id
      )
      values ($1, 'person', $2, 'invited', $3)
      returning id`,
      [replacementRequest.schedule_slot_id, personId, replacementRequestId],
    );
    const candidateAssignment = candidateAssignmentResult.rows[0];
    if (!candidateAssignment) {
      throw new Error("Replacement assignment insert did not return a row");
    }

    await client.query(
      `update ${schema}.replacement_requests
       set status = 'waiting_response',
           updated_at = now()
       where id = $1`,
      [replacementRequestId],
    );

    await recordAuditEvent(client, schema, {
      actor,
      action: auditActions.replacementCandidateInvited,
      entityType: "schedule",
      entityId: scheduleId,
      context: {
        replacementRequestId,
        originalAssignmentId: replacementRequest.assignment_id,
        candidateAssignmentId: candidateAssignment.id,
        candidatePersonId: personId,
      },
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getScheduleDraftById(schema, scheduleId);
}

export async function completeReplacementRequest(
  schema: string,
  replacementRequestId: string,
  actor: AuditActor = systemAuditActor,
) {
  const client = await pool.connect();
  let scheduleId = "";

  try {
    await client.query("begin");
    await ensureReplacementRequestAssignmentLink(client, schema);

    const requestResult = await client.query<{
      assignment_id: string;
      schedule_id: string;
      status: string;
    }>(
      `select
         rr.assignment_id,
         rr.status,
         s.id as schedule_id
       from ${schema}.replacement_requests rr
       join ${schema}.assignments a on a.id = rr.assignment_id
       join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
       join ${schema}.schedules s on s.id = ss.schedule_id
       where rr.id = $1
       limit 1`,
      [replacementRequestId],
    );

    const replacementRequest = requestResult.rows[0];
    if (!replacementRequest) {
      throw new ReplacementRequestManagerError(
        "replacement_request_not_found",
        "Replacement request not found.",
      );
    }

    scheduleId = replacementRequest.schedule_id;

    if (replacementRequest.status !== "accepted") {
      throw new ReplacementRequestManagerError(
        "replacement_request_not_open",
        "Replacement request is not ready to be completed.",
      );
    }

    const candidateResult = await client.query<{ id: string }>(
      `select id
       from ${schema}.assignments
       where replacement_request_id = $1
         and status in ('confirmed', 'externally_confirmed')
       order by updated_at desc, created_at desc
       limit 1`,
      [replacementRequestId],
    );

    const candidate = candidateResult.rows[0];
    if (!candidate) {
      throw new ReplacementRequestManagerError(
        "replacement_candidate_not_confirmed",
        "Replacement candidate has not confirmed yet.",
      );
    }

    await client.query(
      `update ${schema}.assignments
       set status = 'cancelled',
           updated_at = now()
       where id = $1`,
      [replacementRequest.assignment_id],
    );

    await client.query(
      `update ${schema}.replacement_requests
       set status = 'completed',
           updated_at = now()
       where id = $1`,
      [replacementRequestId],
    );

    await recordAuditEvent(client, schema, {
      actor,
      action: auditActions.replacementCompleted,
      entityType: "schedule",
      entityId: scheduleId,
      context: {
        replacementRequestId,
        originalAssignmentId: replacementRequest.assignment_id,
        candidateAssignmentId: candidate.id,
      },
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getScheduleDraftById(schema, scheduleId);
}

export async function createReplacementRequest(
  schema: string,
  personId: string,
  assignmentId: string,
  input: CreateReplacementRequestInput,
  actor: AuditActor = { type: "member", personId },
) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const assignmentResult = await client.query<{
      id: string;
      schedule_id: string;
      status: string;
    }>(
      `select a.id, a.status, s.id as schedule_id
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

    if (!["confirmed", "externally_confirmed"].includes(assignment.status)) {
      throw new MemberScheduleError(
        "assignment_not_actionable",
        "Assignment cannot request replacement.",
      );
    }

    const existingRequestResult = await client.query<{ id: string }>(
      `select id
       from ${schema}.replacement_requests
       where assignment_id = $1
         and status in ('requested', 'under_review', 'waiting_response', 'accepted')
       limit 1`,
      [assignmentId],
    );

    if (existingRequestResult.rows[0]) {
      throw new MemberScheduleError(
        "replacement_request_already_exists",
        "Replacement request already exists.",
      );
    }

    const replacementRequestResult = await client.query<{ id: string }>(
      `insert into ${schema}.replacement_requests (
         assignment_id,
         requested_by_person_id,
         reason,
         urgent
       )
       values ($1, $2, $3, $4)
       returning id`,
      [assignmentId, personId, input.reason ?? null, input.urgent ?? false],
    );
    const replacementRequest = replacementRequestResult.rows[0];
    if (!replacementRequest) {
      throw new Error("Replacement request insert did not return a row");
    }

    await recordAuditEvent(client, schema, {
      actor,
      action: auditActions.replacementRequested,
      entityType: "schedule",
      entityId: assignment.schedule_id,
      context: {
        replacementRequestId: replacementRequest.id,
        assignmentId,
        personId,
        reason: input.reason ?? null,
        urgent: input.urgent ?? false,
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
