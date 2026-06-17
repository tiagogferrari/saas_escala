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

export type MemberSchedule = {
  assignment: ScheduleAssignment;
  schedule: {
    id: string;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string;
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
  };
  companions: ScheduleAssignment[];
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

type MemberScheduleRow = {
  assignment_id: string;
  assignment_status: string;
  assignment_confirmed_at: Date | null;
  assignment_confirmation_source: string | null;
  assignment_created_at: Date;
  assignee_id: string;
  assignee_name: string;
  schedule_id: string;
  title: string;
  schedule_status: string;
  starts_at: Date;
  ends_at: Date;
  location_id: string;
  location_name: string;
  slot_id: string;
  function_id: string;
  function_name: string;
  required_count: number;
};

type ScheduleAssignmentErrorCode =
  | "assignment_already_exists"
  | "person_not_found"
  | "schedule_not_draft"
  | "schedule_not_found"
  | "slot_full";

type SchedulePublicationErrorCode =
  | "schedule_not_draft"
  | "schedule_not_found";

type MemberScheduleErrorCode =
  | "assignment_not_actionable"
  | "assignment_not_found"
  | "person_not_found";

export class ScheduleAssignmentError extends Error {
  constructor(
    public readonly code: ScheduleAssignmentErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class SchedulePublicationError extends Error {
  constructor(
    public readonly code: SchedulePublicationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class MemberScheduleError extends Error {
  constructor(
    public readonly code: MemberScheduleErrorCode,
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

function mapMemberSchedule(
  row: MemberScheduleRow,
  companions: ScheduleAssignment[],
): MemberSchedule {
  return {
    assignment: {
      id: row.assignment_id,
      scheduleSlotId: row.slot_id,
      assigneeType: "person",
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_name,
      status: row.assignment_status,
      confirmedAt: row.assignment_confirmed_at?.toISOString() ?? null,
      confirmationSource: row.assignment_confirmation_source,
      createdAt: row.assignment_created_at.toISOString(),
    },
    schedule: {
      id: row.schedule_id,
      title: row.title,
      status: row.schedule_status,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
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
    },
    companions,
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
       a.assignee_id,
       p.display_name as assignee_name,
       s.id as schedule_id,
       s.title,
       s.status as schedule_status,
       s.starts_at,
       s.ends_at,
       l.id as location_id,
       l.name as location_name,
       ss.id as slot_id,
       f.id as function_id,
       f.name as function_name,
       ss.required_count
     from ${schema}.assignments a
     join ${schema}.people p on p.id = a.assignee_id
     join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
     join ${schema}.schedules s on s.id = ss.schedule_id
     join ${schema}.locations l on l.id = s.location_id
     join ${schema}.functions f on f.id = ss.function_id
     where a.assignee_type = 'person'
       and a.assignee_id = $1
       and s.status = 'published'
     order by s.starts_at asc, s.created_at asc`,
    [personId],
  );

  const assignmentsBySlot = await listAssignmentsBySlotIds(
    schema,
    result.rows.map((row) => row.slot_id),
  );

  return result.rows.map((row) => {
    const companions = (assignmentsBySlot.get(row.slot_id) ?? []).filter(
      (assignment) =>
        assignment.id !== row.assignment_id &&
        assignment.status !== "cancelled" &&
        assignment.status !== "declined",
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
      schedule_status: string;
    }>(
      `select
         ss.id,
         ss.required_count,
         s.status as schedule_status
       from ${schema}.schedules s
       join ${schema}.schedule_slots ss on ss.schedule_id = s.id
       where s.id = $1
       order by ss.created_at asc
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

    if (slot.schedule_status !== "draft") {
      throw new ScheduleAssignmentError(
        "schedule_not_draft",
        "Only draft schedules can receive assignments.",
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

export async function publishSchedule(schema: string, scheduleId: string) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const scheduleResult = await client.query<{
      status: string;
      slot_id: string;
      required_count: number;
    }>(
      `select
         s.status,
         ss.id as slot_id,
         ss.required_count
       from ${schema}.schedules s
       join ${schema}.schedule_slots ss on ss.schedule_id = s.id
       where s.id = $1
       order by ss.created_at asc
       limit 1`,
      [scheduleId],
    );

    const schedule = scheduleResult.rows[0];
    if (!schedule) {
      throw new SchedulePublicationError(
        "schedule_not_found",
        "Schedule not found.",
      );
    }

    if (schedule.status !== "published" && schedule.status !== "draft") {
      throw new SchedulePublicationError(
        "schedule_not_draft",
        "Only draft schedules can be published.",
      );
    }

    if (schedule.status === "draft") {
      await client.query(
        `update ${schema}.schedules
         set status = 'published',
             published_at = now(),
             updated_at = now()
         where id = $1`,
        [scheduleId],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getScheduleDraftById(schema, scheduleId);
}

export async function respondToMemberScheduleAssignment(
  schema: string,
  personId: string,
  assignmentId: string,
  status: "confirmed" | "declined",
) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const assignmentResult = await client.query<{
      id: string;
      status: string;
    }>(
      `select a.id, a.status
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

    if (!["invited", "pending", "confirmed", "declined"].includes(assignment.status)) {
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

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return listMemberSchedules(schema, personId);
}
