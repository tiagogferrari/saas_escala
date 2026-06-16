import type { PoolClient } from "pg";
import { pool } from "../db/pool";

export type ScheduleAssignment = {
  id: string;
  scheduleSlotId: string;
  assigneeType: "person" | "group";
  assigneeId: string;
  assigneeName: string;
  status: string;
  confirmedAt: string | null;
  confirmationSource: string | null;
  createdAt: string;
};

export type ScheduleDraft = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  meetingPoint: string | null;
  instructions: string | null;
  location: {
    id: string;
    name: string;
  };
  slot: {
    id: string;
    requiredCount: number;
    function: {
      id: string;
      name: string;
    };
  };
  assignments: ScheduleAssignment[];
  createdAt: string;
};

export type CreateScheduleDraftInput = {
  title: string;
  locationId: string;
  functionId: string;
  startsAt: string;
  endsAt: string;
  requiredCount: number;
  meetingPoint?: string | null;
  instructions?: string | null;
};

export type CreateScheduleAssignmentInput = {
  personId: string;
  status: "invited" | "externally_confirmed";
};

type ScheduleDraftRow = {
  schedule_id: string;
  title: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  meeting_point: string | null;
  instructions: string | null;
  location_id: string;
  location_name: string;
  slot_id: string;
  function_id: string;
  function_name: string;
  required_count: number;
  created_at: Date;
};

type ScheduleAssignmentRow = {
  id: string;
  schedule_slot_id: string;
  assignee_type: "person" | "group";
  assignee_id: string;
  assignee_name: string;
  status: string;
  confirmed_at: Date | null;
  confirmation_source: string | null;
  created_at: Date;
};

type ScheduleAssignmentErrorCode =
  | "assignment_already_exists"
  | "person_not_found"
  | "schedule_not_found"
  | "slot_full";

export class ScheduleAssignmentError extends Error {
  constructor(
    public readonly code: ScheduleAssignmentErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function mapScheduleDraft(row: ScheduleDraftRow): ScheduleDraft {
  return {
    id: row.schedule_id,
    title: row.title,
    status: row.status,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    meetingPoint: row.meeting_point,
    instructions: row.instructions,
    location: {
      id: row.location_id,
      name: row.location_name,
    },
    slot: {
      id: row.slot_id,
      requiredCount: row.required_count,
      function: {
        id: row.function_id,
        name: row.function_name,
      },
    },
    assignments: [],
    createdAt: row.created_at.toISOString(),
  };
}

function mapScheduleAssignment(row: ScheduleAssignmentRow): ScheduleAssignment {
  return {
    id: row.id,
    scheduleSlotId: row.schedule_slot_id,
    assigneeType: row.assignee_type,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    status: row.status,
    confirmedAt: row.confirmed_at?.toISOString() ?? null,
    confirmationSource: row.confirmation_source,
    createdAt: row.created_at.toISOString(),
  };
}

const scheduleSummarySelect = `
select
  s.id as schedule_id,
  s.title,
  s.status,
  s.starts_at,
  s.ends_at,
  s.meeting_point,
  s.instructions,
  l.id as location_id,
  l.name as location_name,
  ss.id as slot_id,
  f.id as function_id,
  f.name as function_name,
  ss.required_count,
  s.created_at
`;

const assignmentSummarySelect = `
select
  a.id,
  a.schedule_slot_id,
  a.assignee_type,
  a.assignee_id,
  coalesce(p.display_name, g.name, 'Sem nome') as assignee_name,
  a.status,
  a.confirmed_at,
  a.confirmation_source,
  a.created_at
`;

async function listAssignmentsBySlotIds(schema: string, slotIds: string[]) {
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
     where a.schedule_slot_id = any($1::uuid[])
     order by a.created_at asc`,
    [slotIds],
  );

  for (const row of result.rows) {
    const assignment = mapScheduleAssignment(row);
    const currentAssignments = assignmentsBySlot.get(row.schedule_slot_id) ?? [];
    currentAssignments.push(assignment);
    assignmentsBySlot.set(row.schedule_slot_id, currentAssignments);
  }

  return assignmentsBySlot;
}

async function findAssignmentById(
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

async function attachAssignmentsToSchedules(
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

export async function createScheduleDraft(
  schema: string,
  input: CreateScheduleDraftInput,
) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const scheduleResult = await client.query<{ id: string }>(
      `insert into ${schema}.schedules (
        location_id,
        title,
        starts_at,
        ends_at,
        meeting_point,
        instructions
      )
      values ($1, $2, $3, $4, $5, $6)
      returning id`,
      [
        input.locationId,
        input.title,
        input.startsAt,
        input.endsAt,
        input.meetingPoint ?? null,
        input.instructions ?? null,
      ],
    );

    const schedule = scheduleResult.rows[0];
    if (!schedule) {
      throw new Error("Schedule insert did not return a row");
    }

    const slotResult = await client.query<{ id: string }>(
      `insert into ${schema}.schedule_slots (
        schedule_id,
        function_id,
        required_count
      )
      values ($1, $2, $3)
      returning id`,
      [schedule.id, input.functionId, input.requiredCount],
    );

    const slot = slotResult.rows[0];
    if (!slot) {
      throw new Error("Schedule slot insert did not return a row");
    }

    const summaryResult = await client.query<ScheduleDraftRow>(
      `${scheduleSummarySelect}
       from ${schema}.schedules s
       join ${schema}.locations l on l.id = s.location_id
       join ${schema}.schedule_slots ss on ss.schedule_id = s.id
       join ${schema}.functions f on f.id = ss.function_id
       where s.id = $1 and ss.id = $2`,
      [schedule.id, slot.id],
    );

    const summary = summaryResult.rows[0];
    if (!summary) {
      throw new Error("Schedule summary query did not return a row");
    }

    await client.query("commit");
    return mapScheduleDraft(summary);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

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

  return attachAssignmentsToSchedules(schema, result.rows.map(mapScheduleDraft));
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

export async function createScheduleAssignment(
  schema: string,
  scheduleId: string,
  input: CreateScheduleAssignmentInput,
) {
  const client = await pool.connect();

  try {
    await client.query("begin");

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
    }>(
      `select id, required_count
       from ${schema}.schedule_slots
       where schedule_id = $1
       order by created_at asc
       limit 1`,
      [scheduleId],
    );

    const slot = slotResult.rows[0];
    if (!slot) {
      throw new ScheduleAssignmentError(
        "schedule_not_found",
        "Schedule not found.",
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

    const activeCountResult = await client.query<{ active_count: string }>(
      `select count(*) as active_count
       from ${schema}.assignments
       where schedule_slot_id = $1
         and status in ('invited', 'pending', 'confirmed', 'externally_confirmed')`,
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

    await client.query("commit");
    return mappedAssignment;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
