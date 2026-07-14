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
  replacementRequestId: string | null;
  replacementRequest: ReplacementRequest | null;
  notification: NotificationDelivery | null;
  createdAt: string;
};

export type NotificationDelivery = {
  kind: string;
  status: string;
  sentAt: string | null;
  recipientEmail: string;
};

export type ReplacementRequest = {
  id: string;
  assignmentId: string;
  requestedByPersonId: string;
  status: string;
  reason: string | null;
  urgent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleDraft = {
  id: string;
  seriesId: string | null;
  occurrenceDate: string | null;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  meetingPoint: string | null;
  instructions: string | null;
  cancelledReason: string | null;
  cancelledAt: string | null;
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

export type ScheduleSeries = {
  id: string;
  title: string;
  recurrenceIntervalWeeks: number;
  recurrenceEndsOn: string;
  occurrenceCount: number;
  skippedOccurrenceCount: number;
  schedules: ScheduleDraft[];
  createdAt: string;
};

export type ScheduleSeriesOccurrence = {
  occurrenceDate: string;
  title: string;
  startsAt: string;
  endsAt: string;
  scheduleId: string | null;
  scheduleStatus: string | null;
  skipped: boolean;
  exceptionNote: string | null;
  assignmentCount: number;
  requiredCount: number;
  meetingPoint: string | null;
  instructions: string | null;
  location: {
    id: string;
    name: string;
  };
  function: {
    id: string;
    name: string;
  };
};

export type ScheduleSeriesOverview = {
  id: string;
  title: string;
  status: string;
  recurrenceIntervalWeeks: number;
  recurrenceEndsOn: string;
  requiredCount: number;
  location: {
    id: string;
    name: string;
  };
  function: {
    id: string;
    name: string;
  };
  occurrences: ScheduleSeriesOccurrence[];
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
    cancelledReason: string | null;
    cancelledAt: string | null;
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

export type CreateScheduleSeriesInput = {
  title: string;
  locationId: string;
  functionId: string;
  startsAt: string;
  endsAt: string;
  recurrenceIntervalWeeks: number;
  recurrenceEndsOn: string;
  requiredCount: number;
  meetingPoint?: string | null;
  instructions?: string | null;
  skippedDates?: string[];
  skippedOccurrences?: Array<{
    occurrenceDate: string;
    note?: string | null;
  }>;
  defaultAssignmentPersonIds?: string[];
  occurrenceAssignmentOverrides?: Array<{
    occurrenceDate: string;
    personIds: string[];
  }>;
  assignmentStatus: "invited" | "externally_confirmed";
};

export type UpdateScheduleSeriesOccurrenceInput = {
  skipped: boolean;
  note?: string | null;
};

export type UpdateScheduleSeriesOccurrenceDetailsInput = {
  title?: string;
  locationId?: string;
  functionId?: string;
  startsAt?: string;
  endsAt?: string;
  requiredCount?: number;
  meetingPoint?: string | null;
  instructions?: string | null;
};

export type UpdateScheduleSeriesInput = {
  title?: string;
  locationId?: string;
  functionId?: string;
  startsAt?: string;
  endsAt?: string;
  recurrenceIntervalWeeks?: number;
  recurrenceEndsOn?: string;
  requiredCount?: number;
  meetingPoint?: string | null;
  instructions?: string | null;
  applyFrom?: string;
};

export type UpdateScheduleSeriesResult = {
  series: ScheduleSeriesOverview;
  applyFrom: string;
  createdDraftSchedules: number;
  updatedDraftSchedules: number;
  cancelledDraftSchedules: number;
};

export type CancelScheduleSeriesInput = {
  cancelFrom: string;
  note?: string | null;
};

export type CancelScheduleSeriesResult = {
  seriesId: string;
  status: "archived";
  cancelFrom: string;
  cancelledSchedules: number;
  cancelledAssignments: number;
  cancelledReplacementRequests: number;
  skippedOccurrences: number;
};

export type CreateReplacementRequestInput = {
  reason?: string | null;
  urgent?: boolean;
};

type ScheduleDraftRow = {
  schedule_id: string;
  series_id: string | null;
  series_occurrence_date: Date | null;
  title: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  meeting_point: string | null;
  instructions: string | null;
  cancelled_reason: string | null;
  cancelled_at: Date | null;
  location_id: string;
  location_name: string;
  slot_id: string;
  function_id: string;
  function_name: string;
  required_count: number;
  created_at: Date;
};

type ScheduleSeriesRow = {
  id: string;
  title: string;
  status: string;
  location_id: string;
  location_name: string;
  function_id: string;
  function_name: string;
  anchor_starts_at: Date;
  anchor_ends_at: Date;
  recurrence_interval_weeks: number;
  recurrence_ends_on: Date;
  required_count: number;
  meeting_point: string | null;
  instructions: string | null;
  created_at: Date;
};

type ScheduleSeriesScheduleRow = {
  series_id: string;
  occurrence_date: Date;
  schedule_id: string;
  schedule_status: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  location_id: string;
  location_name: string;
  function_id: string;
  function_name: string;
  required_count: number;
  meeting_point: string | null;
  instructions: string | null;
  assignment_count: string;
};

type ScheduleSeriesExistingScheduleRow = {
  id: string;
  occurrence_date: Date;
  status: string;
  slot_id: string;
  active_assignment_count: string;
};

type ScheduleSeriesOccurrenceDetailsScheduleRow = {
  id: string;
  title: string;
  status: string;
  location_id: string;
  starts_at: Date;
  ends_at: Date;
  meeting_point: string | null;
  instructions: string | null;
  slot_id: string;
  function_id: string;
  required_count: number;
  active_assignment_count: string;
};

type ScheduleSeriesExceptionRow = {
  series_id: string;
  occurrence_date: Date;
  note: string | null;
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
  linked_replacement_request_id: string | null;
  replacement_request_id: string | null;
  replacement_requested_by_person_id: string | null;
  replacement_request_status: string | null;
  replacement_request_reason: string | null;
  replacement_request_urgent: boolean | null;
  replacement_request_created_at: Date | null;
  replacement_request_updated_at: Date | null;
  notification_kind: string | null;
  notification_status: string | null;
  notification_sent_at: Date | null;
  notification_recipient_email: string | null;
};

type MemberScheduleRow = {
  assignment_id: string;
  assignment_status: string;
  assignment_confirmed_at: Date | null;
  assignment_confirmation_source: string | null;
  assignment_created_at: Date;
  linked_replacement_request_id: string | null;
  assignee_id: string;
  assignee_name: string;
  schedule_id: string;
  title: string;
  schedule_status: string;
  starts_at: Date;
  ends_at: Date;
  cancelled_reason: string | null;
  cancelled_at: Date | null;
  location_id: string;
  location_name: string;
  slot_id: string;
  function_id: string;
  function_name: string;
  required_count: number;
  replacement_request_id: string | null;
  replacement_requested_by_person_id: string | null;
  replacement_request_status: string | null;
  replacement_request_reason: string | null;
  replacement_request_urgent: boolean | null;
  replacement_request_created_at: Date | null;
  replacement_request_updated_at: Date | null;
};

type ScheduleAssignmentErrorCode =
  | "assignment_already_exists"
  | "person_not_found"
  | "person_unavailable"
  | "schedule_not_assignable"
  | "schedule_not_found"
  | "slot_full";

type SchedulePublicationErrorCode = "schedule_not_draft" | "schedule_not_found";

type MemberScheduleErrorCode =
  | "assignment_not_actionable"
  | "assignment_not_found"
  | "person_not_found"
  | "replacement_request_already_exists";

type ReplacementRequestManagerErrorCode =
  | "assignment_already_exists"
  | "person_not_found"
  | "person_unavailable"
  | "replacement_candidate_not_confirmed"
  | "replacement_request_not_found"
  | "replacement_request_not_open"
  | "schedule_not_assignable";

type ScheduleSeriesErrorCode =
  | "occurrence_not_editable"
  | "person_not_found"
  | "person_unavailable"
  | "series_already_archived"
  | "series_invalid"
  | "series_not_found"
  | "series_reference_not_found"
  | "series_too_large";

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

export class ReplacementRequestManagerError extends Error {
  constructor(
    public readonly code: ReplacementRequestManagerErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class ScheduleSeriesError extends Error {
  constructor(
    public readonly code: ScheduleSeriesErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function mapScheduleDraft(row: ScheduleDraftRow): ScheduleDraft {
  return {
    id: row.schedule_id,
    seriesId: row.series_id,
    occurrenceDate: row.series_occurrence_date
      ? getDateKey(row.series_occurrence_date)
      : null,
    title: row.title,
    status: row.status,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    meetingPoint: row.meeting_point,
    instructions: row.instructions,
    cancelledReason: row.cancelled_reason,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
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
      replacementRequestId: row.linked_replacement_request_id,
      replacementRequest: mapReplacementRequest({
        id: row.replacement_request_id,
        assignment_id: row.assignment_id,
        requested_by_person_id: row.replacement_requested_by_person_id,
        status: row.replacement_request_status,
        reason: row.replacement_request_reason,
        urgent: row.replacement_request_urgent,
        created_at: row.replacement_request_created_at,
        updated_at: row.replacement_request_updated_at,
      }),
      notification: null,
      createdAt: row.assignment_created_at.toISOString(),
    },
    schedule: {
      id: row.schedule_id,
      title: row.title,
      status: row.schedule_status,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      cancelledReason: row.cancelled_reason,
      cancelledAt: row.cancelled_at?.toISOString() ?? null,
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

function mapReplacementRequest(row: {
  id: string | null;
  assignment_id: string;
  requested_by_person_id: string | null;
  status: string | null;
  reason: string | null;
  urgent: boolean | null;
  created_at: Date | null;
  updated_at: Date | null;
}): ReplacementRequest | null {
  if (!row.id || !row.requested_by_person_id || !row.status) {
    return null;
  }

  return {
    id: row.id,
    assignmentId: row.assignment_id,
    requestedByPersonId: row.requested_by_person_id,
    status: row.status,
    reason: row.reason,
    urgent: row.urgent ?? false,
    createdAt: row.created_at?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? new Date(0).toISOString(),
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
    replacementRequestId: row.linked_replacement_request_id,
    replacementRequest: mapReplacementRequest({
      id: row.replacement_request_id,
      assignment_id: row.id,
      requested_by_person_id: row.replacement_requested_by_person_id,
      status: row.replacement_request_status,
      reason: row.replacement_request_reason,
      urgent: row.replacement_request_urgent,
      created_at: row.replacement_request_created_at,
      updated_at: row.replacement_request_updated_at,
    }),
    notification: mapNotificationDelivery(row),
    createdAt: row.created_at.toISOString(),
  };
}

function mapNotificationDelivery(
  row: ScheduleAssignmentRow,
): NotificationDelivery | null {
  if (
    !row.notification_kind ||
    !row.notification_status ||
    !row.notification_recipient_email
  ) {
    return null;
  }

  return {
    kind: row.notification_kind,
    status: row.notification_status,
    sentAt: row.notification_sent_at?.toISOString() ?? null,
    recipientEmail: row.notification_recipient_email,
  };
}

const scheduleSummarySelect = `
select
  s.id as schedule_id,
  s.series_id,
  s.series_occurrence_date,
  s.title,
  s.status,
  s.starts_at,
  s.ends_at,
  s.meeting_point,
  s.instructions,
  s.cancelled_reason,
  s.cancelled_at,
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
  a.created_at,
  a.replacement_request_id as linked_replacement_request_id,
  rr.id as replacement_request_id,
  rr.requested_by_person_id as replacement_requested_by_person_id,
  rr.status as replacement_request_status,
  rr.reason as replacement_request_reason,
  rr.urgent as replacement_request_urgent,
  rr.created_at as replacement_request_created_at,
  rr.updated_at as replacement_request_updated_at,
  nd.kind as notification_kind,
  nd.status as notification_status,
  nd.sent_at as notification_sent_at,
  nd.recipient_email as notification_recipient_email
`;

function replacementRequestJoin(schema: string) {
  return `
     left join lateral (
       select
         rr.id,
         rr.requested_by_person_id,
         rr.status,
         rr.reason,
         rr.urgent,
         rr.created_at,
         rr.updated_at
       from ${schema}.replacement_requests rr
       where rr.assignment_id = a.id
         and rr.status in ('requested', 'under_review', 'waiting_response', 'accepted', 'completed')
       order by rr.created_at desc
       limit 1
     ) rr on true`;
}

function notificationDeliveryJoin(schema: string) {
  return `
     left join lateral (
       select
         nd.kind,
         nd.status,
         nd.sent_at,
         nd.recipient_email
       from ${schema}.notification_deliveries nd
       where nd.assignment_id = a.id
       order by nd.created_at desc
       limit 1
     ) nd on true`;
}

async function ensureReplacementRequestAssignmentLink(
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

async function hasOverlappingActiveAssignment(
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

function getDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeOptionalText(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function buildSeriesOccurrences(
  startsAt: Date,
  endsAt: Date,
  intervalWeeks: number,
  recurrenceEndsOn: string,
) {
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt ||
    intervalWeeks < 1
  ) {
    throw new ScheduleSeriesError(
      "series_invalid",
      "Schedule series has an invalid recurrence.",
    );
  }

  const occurrences: Array<{ startsAt: Date; endsAt: Date; date: string }> = [];
  const intervalMs = intervalWeeks * 7 * 24 * 60 * 60 * 1000;

  for (let index = 0; index < 104; index += 1) {
    const occurrenceStartsAt = new Date(
      startsAt.getTime() + index * intervalMs,
    );
    const occurrenceDate = getDateKey(occurrenceStartsAt);

    if (occurrenceDate > recurrenceEndsOn) {
      return occurrences;
    }

    occurrences.push({
      startsAt: occurrenceStartsAt,
      endsAt: new Date(endsAt.getTime() + index * intervalMs),
      date: occurrenceDate,
    });
  }

  throw new ScheduleSeriesError(
    "series_too_large",
    "Schedule series exceeds the supported occurrence limit.",
  );
}

function getSeriesOccurrences(input: CreateScheduleSeriesInput) {
  return buildSeriesOccurrences(
    new Date(input.startsAt),
    new Date(input.endsAt),
    input.recurrenceIntervalWeeks,
    input.recurrenceEndsOn,
  );
}

function getSeriesRowOccurrences(row: ScheduleSeriesRow) {
  return buildSeriesOccurrences(
    row.anchor_starts_at,
    row.anchor_ends_at,
    row.recurrence_interval_weeks,
    getDateKey(row.recurrence_ends_on),
  );
}

function uniquePersonIds(personIds: string[]) {
  return [...new Set(personIds)];
}

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

function mapScheduleSeriesOverview(
  row: ScheduleSeriesRow,
  schedulesBySeries: Map<string, Map<string, ScheduleSeriesScheduleRow>>,
  exceptionsBySeries: Map<string, Map<string, string | null>>,
): ScheduleSeriesOverview {
  const schedulesByDate = schedulesBySeries.get(row.id) ?? new Map();
  const exceptionsByDate = exceptionsBySeries.get(row.id) ?? new Map();
  const occurrences = getSeriesRowOccurrences(row).map((occurrence) => {
    const schedule = schedulesByDate.get(occurrence.date);
    const exceptionNote = exceptionsByDate.get(occurrence.date) ?? null;

    return {
      occurrenceDate: occurrence.date,
      title: schedule?.title ?? row.title,
      startsAt: (schedule?.starts_at ?? occurrence.startsAt).toISOString(),
      endsAt: (schedule?.ends_at ?? occurrence.endsAt).toISOString(),
      scheduleId: schedule?.schedule_id ?? null,
      scheduleStatus: schedule?.schedule_status ?? null,
      skipped: exceptionsByDate.has(occurrence.date),
      exceptionNote,
      assignmentCount: Number(schedule?.assignment_count ?? 0),
      requiredCount: schedule?.required_count ?? row.required_count,
      meetingPoint: schedule ? schedule.meeting_point : row.meeting_point,
      instructions: schedule ? schedule.instructions : row.instructions,
      location: {
        id: schedule?.location_id ?? row.location_id,
        name: schedule?.location_name ?? row.location_name,
      },
      function: {
        id: schedule?.function_id ?? row.function_id,
        name: schedule?.function_name ?? row.function_name,
      },
    };
  });

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    recurrenceIntervalWeeks: row.recurrence_interval_weeks,
    recurrenceEndsOn: getDateKey(row.recurrence_ends_on),
    requiredCount: row.required_count,
    location: {
      id: row.location_id,
      name: row.location_name,
    },
    function: {
      id: row.function_id,
      name: row.function_name,
    },
    occurrences,
    createdAt: row.created_at.toISOString(),
  };
}

function addScheduleSeriesScheduleToMap(
  schedulesBySeries: Map<string, Map<string, ScheduleSeriesScheduleRow>>,
  row: ScheduleSeriesScheduleRow,
) {
  const date = getDateKey(row.occurrence_date);
  const schedulesByDate = schedulesBySeries.get(row.series_id) ?? new Map();
  schedulesByDate.set(date, row);
  schedulesBySeries.set(row.series_id, schedulesByDate);
}

function addScheduleSeriesExceptionToMap(
  exceptionsBySeries: Map<string, Map<string, string | null>>,
  row: ScheduleSeriesExceptionRow,
) {
  const date = getDateKey(row.occurrence_date);
  const exceptionsByDate = exceptionsBySeries.get(row.series_id) ?? new Map();
  exceptionsByDate.set(date, row.note);
  exceptionsBySeries.set(row.series_id, exceptionsByDate);
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

export async function createScheduleSeries(
  schema: string,
  input: CreateScheduleSeriesInput,
) {
  const occurrences = getSeriesOccurrences(input);
  if (occurrences.length === 0) {
    throw new ScheduleSeriesError(
      "series_invalid",
      "Schedule series does not contain any occurrences.",
    );
  }

  const occurrenceDates = new Set(
    occurrences.map((occurrence) => occurrence.date),
  );
  const skippedOccurrences = new Map<string, string | null>();

  for (const date of input.skippedDates ?? []) {
    skippedOccurrences.set(date, null);
  }

  for (const occurrence of input.skippedOccurrences ?? []) {
    skippedOccurrences.set(
      occurrence.occurrenceDate,
      normalizeOptionalText(occurrence.note),
    );
  }

  const skippedDates = new Set(skippedOccurrences.keys());
  const defaultAssignmentPersonIds = uniquePersonIds(
    input.defaultAssignmentPersonIds ?? [],
  );
  const assignmentsByOccurrence = new Map<string, string[]>();

  for (const date of skippedDates) {
    if (!occurrenceDates.has(date)) {
      throw new ScheduleSeriesError(
        "series_invalid",
        "Skipped date is not part of the schedule series.",
      );
    }
  }

  for (const override of input.occurrenceAssignmentOverrides ?? []) {
    if (
      !occurrenceDates.has(override.occurrenceDate) ||
      skippedDates.has(override.occurrenceDate) ||
      assignmentsByOccurrence.has(override.occurrenceDate)
    ) {
      throw new ScheduleSeriesError(
        "series_invalid",
        "Occurrence assignment override is invalid.",
      );
    }

    assignmentsByOccurrence.set(
      override.occurrenceDate,
      uniquePersonIds(override.personIds),
    );
  }

  const allPersonIds = new Set(defaultAssignmentPersonIds);
  for (const personIds of assignmentsByOccurrence.values()) {
    for (const personId of personIds) {
      allPersonIds.add(personId);
    }
  }

  const client = await pool.connect();
  const scheduleIds: string[] = [];
  let seriesId = "";
  let seriesCreatedAt = new Date();

  try {
    await client.query("begin");

    if (allPersonIds.size > 0) {
      const peopleResult = await client.query<{ id: string }>(
        `select id
         from ${schema}.people
         where id = any($1::uuid[])
           and status = 'active'`,
        [[...allPersonIds]],
      );

      if (peopleResult.rows.length !== allPersonIds.size) {
        throw new ScheduleSeriesError(
          "person_not_found",
          "One or more people are unavailable.",
        );
      }
    }

    const seriesResult = await client.query<{ id: string; created_at: Date }>(
      `insert into ${schema}.schedule_series (
        title,
        location_id,
        function_id,
        anchor_starts_at,
        anchor_ends_at,
        recurrence_interval_weeks,
        recurrence_ends_on,
        required_count,
        meeting_point,
        instructions
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning id, created_at`,
      [
        input.title,
        input.locationId,
        input.functionId,
        input.startsAt,
        input.endsAt,
        input.recurrenceIntervalWeeks,
        input.recurrenceEndsOn,
        input.requiredCount,
        input.meetingPoint ?? null,
        input.instructions ?? null,
      ],
    );
    const series = seriesResult.rows[0];
    if (!series) {
      throw new Error("Schedule series insert did not return a series");
    }

    seriesId = series.id;
    seriesCreatedAt = series.created_at;

    for (const [skippedDate, note] of skippedOccurrences) {
      await client.query(
        `insert into ${schema}.schedule_series_exceptions (
          series_id,
          occurrence_date,
          note
        )
        values ($1, $2, $3)`,
        [seriesId, skippedDate, note],
      );
    }

    for (const occurrence of occurrences) {
      if (skippedDates.has(occurrence.date)) {
        continue;
      }

      const personIds =
        assignmentsByOccurrence.get(occurrence.date) ??
        defaultAssignmentPersonIds;
      if (personIds.length > input.requiredCount) {
        throw new ScheduleSeriesError(
          "series_invalid",
          "An occurrence has more people than available slots.",
        );
      }

      for (const personId of personIds) {
        const hasConflict = await hasOverlappingActiveAssignment(
          client,
          schema,
          personId,
          occurrence.startsAt,
          occurrence.endsAt,
          null,
        );

        if (hasConflict) {
          throw new ScheduleSeriesError(
            "person_unavailable",
            "A person has a conflicting schedule occurrence.",
          );
        }
      }

      const scheduleResult = await client.query<{ id: string }>(
        `insert into ${schema}.schedules (
          series_id,
          series_occurrence_date,
          location_id,
          title,
          starts_at,
          ends_at,
          meeting_point,
          instructions
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id`,
        [
          seriesId,
          occurrence.date,
          input.locationId,
          input.title,
          occurrence.startsAt.toISOString(),
          occurrence.endsAt.toISOString(),
          input.meetingPoint ?? null,
          input.instructions ?? null,
        ],
      );
      const schedule = scheduleResult.rows[0];
      if (!schedule) {
        throw new Error(
          "Schedule series occurrence insert did not return a schedule",
        );
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
        throw new Error(
          "Schedule series occurrence insert did not return a slot",
        );
      }

      const isExternallyConfirmed =
        input.assignmentStatus === "externally_confirmed";
      for (const personId of personIds) {
        await client.query(
          `insert into ${schema}.assignments (
            schedule_slot_id,
            assignee_type,
            assignee_id,
            status,
            confirmed_at,
            confirmation_source
          )
          values ($1, 'person', $2, $3, $4, $5)`,
          [
            slot.id,
            personId,
            input.assignmentStatus,
            isExternallyConfirmed ? new Date().toISOString() : null,
            isExternallyConfirmed ? "manager" : null,
          ],
        );
      }

      scheduleIds.push(schedule.id);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const schedules = await Promise.all(
    scheduleIds.map((scheduleId) => getScheduleDraftById(schema, scheduleId)),
  );

  return {
    id: seriesId,
    title: input.title,
    recurrenceIntervalWeeks: input.recurrenceIntervalWeeks,
    recurrenceEndsOn: input.recurrenceEndsOn,
    occurrenceCount: schedules.length,
    skippedOccurrenceCount: skippedDates.size,
    schedules,
    createdAt: seriesCreatedAt.toISOString(),
  } satisfies ScheduleSeries;
}

export async function listScheduleSeries(schema: string) {
  const seriesResult = await pool.query<ScheduleSeriesRow>(
    `select
       sr.id,
       sr.title,
       sr.status,
       sr.anchor_starts_at,
       sr.anchor_ends_at,
       sr.recurrence_interval_weeks,
       sr.recurrence_ends_on,
       sr.required_count,
       sr.meeting_point,
       sr.instructions,
       sr.created_at,
       l.id as location_id,
       l.name as location_name,
       f.id as function_id,
       f.name as function_name
     from ${schema}.schedule_series sr
     join ${schema}.locations l on l.id = sr.location_id
     join ${schema}.functions f on f.id = sr.function_id
     where sr.status <> 'archived'
     order by sr.anchor_starts_at asc, sr.created_at asc
     limit 50`,
  );

  const seriesIds = seriesResult.rows.map((row) => row.id);
  if (seriesIds.length === 0) {
    return [];
  }

  const schedulesResult = await pool.query<ScheduleSeriesScheduleRow>(
    `select
       s.series_id,
       s.series_occurrence_date as occurrence_date,
       s.id as schedule_id,
       s.status as schedule_status,
       s.title,
       s.starts_at,
       s.ends_at,
       s.location_id,
       l.name as location_name,
       ss.function_id,
       f.name as function_name,
       ss.required_count,
       s.meeting_point,
       s.instructions,
       count(a.id) filter (where a.status <> 'cancelled') as assignment_count
     from ${schema}.schedules s
     join ${schema}.locations l on l.id = s.location_id
     left join ${schema}.schedule_slots ss on ss.schedule_id = s.id
     left join ${schema}.functions f on f.id = ss.function_id
     left join ${schema}.assignments a on a.schedule_slot_id = ss.id
     where s.series_id = any($1::uuid[])
       and s.series_occurrence_date is not null
     group by
       s.series_id,
       s.series_occurrence_date,
       s.id,
       s.status,
       s.title,
       s.starts_at,
       s.ends_at,
       s.location_id,
       l.name,
       ss.function_id,
       f.name,
       ss.required_count,
       s.meeting_point,
       s.instructions`,
    [seriesIds],
  );

  const exceptionsResult = await pool.query<ScheduleSeriesExceptionRow>(
    `select series_id, occurrence_date, note
     from ${schema}.schedule_series_exceptions
     where series_id = any($1::uuid[])`,
    [seriesIds],
  );

  const schedulesBySeries = new Map<
    string,
    Map<string, ScheduleSeriesScheduleRow>
  >();
  const exceptionsBySeries = new Map<string, Map<string, string | null>>();

  for (const row of schedulesResult.rows) {
    addScheduleSeriesScheduleToMap(schedulesBySeries, row);
  }

  for (const row of exceptionsResult.rows) {
    addScheduleSeriesExceptionToMap(exceptionsBySeries, row);
  }

  return seriesResult.rows.map((row) =>
    mapScheduleSeriesOverview(row, schedulesBySeries, exceptionsBySeries),
  );
}

export async function updateScheduleSeries(
  schema: string,
  seriesId: string,
  input: UpdateScheduleSeriesInput,
): Promise<UpdateScheduleSeriesResult> {
  const client = await pool.connect();
  const applyFrom = input.applyFrom ?? getDateKey(new Date());
  let createdDraftSchedules = 0;
  let updatedDraftSchedules = 0;
  let cancelledDraftSchedules = 0;

  try {
    await client.query("begin");

    const seriesResult = await client.query<ScheduleSeriesRow>(
      `select
         sr.id,
         sr.title,
         sr.status,
         sr.anchor_starts_at,
         sr.anchor_ends_at,
         sr.recurrence_interval_weeks,
         sr.recurrence_ends_on,
         sr.required_count,
         sr.meeting_point,
         sr.instructions,
         sr.created_at,
         l.id as location_id,
         l.name as location_name,
         f.id as function_id,
         f.name as function_name
       from ${schema}.schedule_series sr
       join ${schema}.locations l on l.id = sr.location_id
       join ${schema}.functions f on f.id = sr.function_id
       where sr.id = $1
       for update of sr`,
      [seriesId],
    );

    const series = seriesResult.rows[0];
    if (!series) {
      throw new ScheduleSeriesError(
        "series_not_found",
        "Schedule series not found.",
      );
    }

    if (series.status === "archived") {
      throw new ScheduleSeriesError(
        "series_already_archived",
        "Schedule series is already archived.",
      );
    }

    const nextTitle = input.title ?? series.title;
    const nextLocationId = input.locationId ?? series.location_id;
    const nextFunctionId = input.functionId ?? series.function_id;
    const nextStartsAt = new Date(
      input.startsAt ?? series.anchor_starts_at.toISOString(),
    );
    const nextEndsAt = new Date(
      input.endsAt ?? series.anchor_ends_at.toISOString(),
    );
    const nextIntervalWeeks =
      input.recurrenceIntervalWeeks ?? series.recurrence_interval_weeks;
    const nextEndsOn =
      input.recurrenceEndsOn ?? getDateKey(series.recurrence_ends_on);
    const nextRequiredCount = input.requiredCount ?? series.required_count;
    const nextMeetingPoint =
      input.meetingPoint === undefined
        ? series.meeting_point
        : normalizeOptionalText(input.meetingPoint);
    const nextInstructions =
      input.instructions === undefined
        ? series.instructions
        : normalizeOptionalText(input.instructions);

    const referenceResult = await client.query<{ location_id: string }>(
      `select l.id as location_id
       from ${schema}.locations l
       join ${schema}.functions f on f.id = $2
       where l.id = $1
       limit 1`,
      [nextLocationId, nextFunctionId],
    );
    if (!referenceResult.rows[0]) {
      throw new ScheduleSeriesError(
        "series_reference_not_found",
        "Schedule series location or function not found.",
      );
    }

    const nextOccurrences = buildSeriesOccurrences(
      nextStartsAt,
      nextEndsAt,
      nextIntervalWeeks,
      nextEndsOn,
    );
    if (nextOccurrences.length === 0) {
      throw new ScheduleSeriesError(
        "series_invalid",
        "Schedule series does not contain any occurrences.",
      );
    }

    const desiredOccurrencesByDate = new Map(
      nextOccurrences
        .filter((occurrence) => occurrence.date >= applyFrom)
        .map((occurrence) => [occurrence.date, occurrence]),
    );

    const exceptionsResult = await client.query<{ occurrence_date: Date }>(
      `select occurrence_date
       from ${schema}.schedule_series_exceptions
       where series_id = $1`,
      [seriesId],
    );
    const skippedDates = new Set(
      exceptionsResult.rows.map((row) => getDateKey(row.occurrence_date)),
    );

    const schedulesResult =
      await client.query<ScheduleSeriesExistingScheduleRow>(
        `select
           s.id,
           s.series_occurrence_date as occurrence_date,
           s.status,
           ss.id as slot_id,
           (
             select count(*)
             from ${schema}.assignments a
             where a.schedule_slot_id = ss.id
               and a.status in (
                 'invited',
                 'pending',
                 'confirmed',
                 'externally_confirmed'
               )
           ) as active_assignment_count
         from ${schema}.schedules s
         join ${schema}.schedule_slots ss on ss.schedule_id = s.id
         where s.series_id = $1
           and s.series_occurrence_date is not null
         for update of s, ss`,
        [seriesId],
      );
    const schedulesByDate = new Map(
      schedulesResult.rows.map((row) => [getDateKey(row.occurrence_date), row]),
    );
    const draftSchedulesToCancel: string[] = [];

    for (const [occurrenceDate, schedule] of schedulesByDate) {
      if (
        occurrenceDate >= applyFrom &&
        schedule.status === "draft" &&
        (!desiredOccurrencesByDate.has(occurrenceDate) ||
          skippedDates.has(occurrenceDate))
      ) {
        draftSchedulesToCancel.push(schedule.id);
      }
    }

    for (const [occurrenceDate, occurrence] of desiredOccurrencesByDate) {
      if (skippedDates.has(occurrenceDate)) {
        continue;
      }

      const schedule = schedulesByDate.get(occurrenceDate);
      if (schedule) {
        if (schedule.status !== "draft") {
          continue;
        }

        if (Number(schedule.active_assignment_count) > nextRequiredCount) {
          throw new ScheduleSeriesError(
            "series_invalid",
            "Draft schedule has more assignments than the new required count.",
          );
        }

        const assigneesResult = await client.query<{ assignee_id: string }>(
          `select a.assignee_id
           from ${schema}.assignments a
           where a.schedule_slot_id = $1
             and a.assignee_type = 'person'
             and a.status in (
               'invited',
               'pending',
               'confirmed',
               'externally_confirmed'
             )`,
          [schedule.slot_id],
        );

        for (const assignee of assigneesResult.rows) {
          const hasConflict = await hasOverlappingActiveAssignment(
            client,
            schema,
            assignee.assignee_id,
            occurrence.startsAt,
            occurrence.endsAt,
            schedule.id,
          );

          if (hasConflict) {
            throw new ScheduleSeriesError(
              "person_unavailable",
              "A person has a conflicting schedule occurrence.",
            );
          }
        }

        await client.query(
          `update ${schema}.schedules
           set location_id = $2,
               title = $3,
               starts_at = $4,
               ends_at = $5,
               meeting_point = $6,
               instructions = $7,
               updated_at = now()
           where id = $1
             and status = 'draft'`,
          [
            schedule.id,
            nextLocationId,
            nextTitle,
            occurrence.startsAt.toISOString(),
            occurrence.endsAt.toISOString(),
            nextMeetingPoint,
            nextInstructions,
          ],
        );

        await client.query(
          `update ${schema}.schedule_slots
           set function_id = $2,
               required_count = $3
           where id = $1`,
          [schedule.slot_id, nextFunctionId, nextRequiredCount],
        );

        updatedDraftSchedules += 1;
        continue;
      }

      const scheduleResult = await client.query<{ id: string }>(
        `insert into ${schema}.schedules (
          series_id,
          series_occurrence_date,
          location_id,
          title,
          starts_at,
          ends_at,
          meeting_point,
          instructions
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id`,
        [
          seriesId,
          occurrenceDate,
          nextLocationId,
          nextTitle,
          occurrence.startsAt.toISOString(),
          occurrence.endsAt.toISOString(),
          nextMeetingPoint,
          nextInstructions,
        ],
      );
      const createdSchedule = scheduleResult.rows[0];
      if (!createdSchedule) {
        throw new Error(
          "Schedule series occurrence insert did not return a schedule",
        );
      }

      await client.query(
        `insert into ${schema}.schedule_slots (
          schedule_id,
          function_id,
          required_count
        )
        values ($1, $2, $3)`,
        [createdSchedule.id, nextFunctionId, nextRequiredCount],
      );

      createdDraftSchedules += 1;
    }

    if (draftSchedulesToCancel.length > 0) {
      const cancelledScheduleResult = await client.query<{ id: string }>(
        `update ${schema}.schedules
         set status = 'cancelled',
             cancelled_reason = $2,
             cancelled_at = now(),
             updated_at = now()
         where id = any($1::uuid[])
           and status = 'draft'
         returning id`,
        [draftSchedulesToCancel, "Fora da nova regra da serie"],
      );
      const cancelledScheduleIds = cancelledScheduleResult.rows.map(
        (row) => row.id,
      );
      cancelledDraftSchedules = cancelledScheduleIds.length;

      if (cancelledScheduleIds.length > 0) {
        await client.query(
          `update ${schema}.assignments a
           set status = 'cancelled',
               updated_at = now()
           from ${schema}.schedule_slots ss
           where ss.schedule_id = any($1::uuid[])
             and a.schedule_slot_id = ss.id
             and a.status <> 'cancelled'`,
          [cancelledScheduleIds],
        );

        await client.query(
          `update ${schema}.replacement_requests rr
           set status = 'cancelled',
               updated_at = now()
           from ${schema}.assignments a
           join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
           where ss.schedule_id = any($1::uuid[])
             and rr.assignment_id = a.id
             and rr.status in (
               'requested',
               'under_review',
               'waiting_response',
               'accepted'
             )`,
          [cancelledScheduleIds],
        );
      }
    }

    await client.query(
      `update ${schema}.schedule_series
       set title = $2,
           location_id = $3,
           function_id = $4,
           anchor_starts_at = $5,
           anchor_ends_at = $6,
           recurrence_interval_weeks = $7,
           recurrence_ends_on = $8,
           required_count = $9,
           meeting_point = $10,
           instructions = $11,
           updated_at = now()
       where id = $1`,
      [
        seriesId,
        nextTitle,
        nextLocationId,
        nextFunctionId,
        nextStartsAt.toISOString(),
        nextEndsAt.toISOString(),
        nextIntervalWeeks,
        nextEndsOn,
        nextRequiredCount,
        nextMeetingPoint,
        nextInstructions,
      ],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const series = (await listScheduleSeries(schema)).find(
    (candidate) => candidate.id === seriesId,
  );
  if (!series) {
    throw new ScheduleSeriesError(
      "series_not_found",
      "Schedule series not found.",
    );
  }

  return {
    series,
    applyFrom,
    createdDraftSchedules,
    updatedDraftSchedules,
    cancelledDraftSchedules,
  };
}

export async function updateScheduleSeriesOccurrenceDetails(
  schema: string,
  seriesId: string,
  occurrenceDate: string,
  input: UpdateScheduleSeriesOccurrenceDetailsInput,
) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const seriesResult = await client.query<ScheduleSeriesRow>(
      `select
         sr.id,
         sr.title,
         sr.status,
         sr.anchor_starts_at,
         sr.anchor_ends_at,
         sr.recurrence_interval_weeks,
         sr.recurrence_ends_on,
         sr.required_count,
         sr.meeting_point,
         sr.instructions,
         sr.created_at,
         l.id as location_id,
         l.name as location_name,
         f.id as function_id,
         f.name as function_name
       from ${schema}.schedule_series sr
       join ${schema}.locations l on l.id = sr.location_id
       join ${schema}.functions f on f.id = sr.function_id
       where sr.id = $1
       for update of sr`,
      [seriesId],
    );

    const series = seriesResult.rows[0];
    if (!series) {
      throw new ScheduleSeriesError(
        "series_not_found",
        "Schedule series not found.",
      );
    }

    if (series.status === "archived") {
      throw new ScheduleSeriesError(
        "series_already_archived",
        "Schedule series is already archived.",
      );
    }

    const occurrence = getSeriesRowOccurrences(series).find(
      (candidate) => candidate.date === occurrenceDate,
    );
    if (!occurrence) {
      throw new ScheduleSeriesError(
        "series_invalid",
        "Occurrence is not part of the schedule series.",
      );
    }

    const scheduleResult =
      await client.query<ScheduleSeriesOccurrenceDetailsScheduleRow>(
        `select
           s.id,
           s.title,
           s.status,
           s.location_id,
           s.starts_at,
           s.ends_at,
           s.meeting_point,
           s.instructions,
           ss.id as slot_id,
           ss.function_id,
           ss.required_count,
           (
             select count(*)
             from ${schema}.assignments a
             where a.schedule_slot_id = ss.id
               and a.status in (
                 'invited',
                 'pending',
                 'confirmed',
                 'externally_confirmed'
               )
           ) as active_assignment_count
         from ${schema}.schedules s
         join ${schema}.schedule_slots ss on ss.schedule_id = s.id
         where s.series_id = $1
           and s.series_occurrence_date = $2::date
         order by ss.created_at asc
         limit 1
         for update of s, ss`,
        [seriesId, occurrenceDate],
      );
    const schedule = scheduleResult.rows[0] ?? null;

    if (schedule?.status === "completed") {
      throw new ScheduleSeriesError(
        "occurrence_not_editable",
        "Completed occurrence cannot be edited.",
      );
    }

    const baseStartsAt = schedule?.starts_at ?? occurrence.startsAt;
    const baseEndsAt = schedule?.ends_at ?? occurrence.endsAt;
    const durationMs = baseEndsAt.getTime() - baseStartsAt.getTime();
    const nextStartsAt = input.startsAt
      ? new Date(input.startsAt)
      : baseStartsAt;
    const nextEndsAt = input.endsAt
      ? new Date(input.endsAt)
      : input.startsAt
        ? new Date(nextStartsAt.getTime() + durationMs)
        : baseEndsAt;

    if (
      Number.isNaN(nextStartsAt.getTime()) ||
      Number.isNaN(nextEndsAt.getTime()) ||
      nextStartsAt >= nextEndsAt
    ) {
      throw new ScheduleSeriesError(
        "series_invalid",
        "Occurrence has an invalid date range.",
      );
    }

    const nextTitle = input.title ?? schedule?.title ?? series.title;
    const nextLocationId =
      input.locationId ?? schedule?.location_id ?? series.location_id;
    const nextFunctionId =
      input.functionId ?? schedule?.function_id ?? series.function_id;
    const nextRequiredCount =
      input.requiredCount ?? schedule?.required_count ?? series.required_count;
    const nextMeetingPoint =
      input.meetingPoint === undefined
        ? schedule
          ? schedule.meeting_point
          : series.meeting_point
        : normalizeOptionalText(input.meetingPoint);
    const nextInstructions =
      input.instructions === undefined
        ? schedule
          ? schedule.instructions
          : series.instructions
        : normalizeOptionalText(input.instructions);

    const referenceResult = await client.query<{ location_id: string }>(
      `select l.id as location_id
       from ${schema}.locations l
       join ${schema}.functions f on f.id = $2
       where l.id = $1
       limit 1`,
      [nextLocationId, nextFunctionId],
    );
    if (!referenceResult.rows[0]) {
      throw new ScheduleSeriesError(
        "series_reference_not_found",
        "Schedule occurrence location or function not found.",
      );
    }

    if (
      schedule &&
      Number(schedule.active_assignment_count) > nextRequiredCount
    ) {
      throw new ScheduleSeriesError(
        "series_invalid",
        "Occurrence has more assignments than the new required count.",
      );
    }

    if (schedule) {
      const assigneesResult = await client.query<{ assignee_id: string }>(
        `select a.assignee_id
         from ${schema}.assignments a
         where a.schedule_slot_id = $1
           and a.assignee_type = 'person'
           and a.status in (
             'invited',
             'pending',
             'confirmed',
             'externally_confirmed'
           )`,
        [schedule.slot_id],
      );

      for (const assignee of assigneesResult.rows) {
        const hasConflict = await hasOverlappingActiveAssignment(
          client,
          schema,
          assignee.assignee_id,
          nextStartsAt,
          nextEndsAt,
          schedule.id,
        );

        if (hasConflict) {
          throw new ScheduleSeriesError(
            "person_unavailable",
            "A person has a conflicting schedule occurrence.",
          );
        }
      }
    }

    await client.query(
      `delete from ${schema}.schedule_series_exceptions
       where series_id = $1
         and occurrence_date = $2::date`,
      [seriesId, occurrenceDate],
    );

    if (schedule) {
      const nextStatus =
        schedule.status === "cancelled" ? "draft" : schedule.status;

      await client.query(
        `update ${schema}.schedules
         set location_id = $2,
             title = $3,
             starts_at = $4,
             ends_at = $5,
             meeting_point = $6,
             instructions = $7,
             status = $8,
             cancelled_reason = case
               when status = 'cancelled' then null
               else cancelled_reason
             end,
             cancelled_at = case
               when status = 'cancelled' then null
               else cancelled_at
             end,
             updated_at = now()
         where id = $1`,
        [
          schedule.id,
          nextLocationId,
          nextTitle,
          nextStartsAt.toISOString(),
          nextEndsAt.toISOString(),
          nextMeetingPoint,
          nextInstructions,
          nextStatus,
        ],
      );

      await client.query(
        `update ${schema}.schedule_slots
         set function_id = $2,
             required_count = $3
         where id = $1`,
        [schedule.slot_id, nextFunctionId, nextRequiredCount],
      );
    } else {
      const scheduleResult = await client.query<{ id: string }>(
        `insert into ${schema}.schedules (
          series_id,
          series_occurrence_date,
          location_id,
          title,
          starts_at,
          ends_at,
          meeting_point,
          instructions
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id`,
        [
          seriesId,
          occurrenceDate,
          nextLocationId,
          nextTitle,
          nextStartsAt.toISOString(),
          nextEndsAt.toISOString(),
          nextMeetingPoint,
          nextInstructions,
        ],
      );
      const createdSchedule = scheduleResult.rows[0];
      if (!createdSchedule) {
        throw new Error(
          "Schedule series occurrence insert did not return a schedule",
        );
      }

      await client.query(
        `insert into ${schema}.schedule_slots (
          schedule_id,
          function_id,
          required_count
        )
        values ($1, $2, $3)`,
        [createdSchedule.id, nextFunctionId, nextRequiredCount],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const series = (await listScheduleSeries(schema)).find(
    (candidate) => candidate.id === seriesId,
  );
  if (!series) {
    throw new ScheduleSeriesError(
      "series_not_found",
      "Schedule series not found.",
    );
  }

  return series;
}

export async function updateScheduleSeriesOccurrence(
  schema: string,
  seriesId: string,
  occurrenceDate: string,
  input: UpdateScheduleSeriesOccurrenceInput,
) {
  const client = await pool.connect();
  const note = normalizeOptionalText(input.note);

  try {
    await client.query("begin");

    const seriesResult = await client.query<ScheduleSeriesRow>(
      `select
         sr.id,
         sr.title,
         sr.status,
         sr.anchor_starts_at,
         sr.anchor_ends_at,
         sr.recurrence_interval_weeks,
         sr.recurrence_ends_on,
         sr.required_count,
         sr.meeting_point,
         sr.instructions,
         sr.created_at,
         l.id as location_id,
         l.name as location_name,
         f.id as function_id,
         f.name as function_name
       from ${schema}.schedule_series sr
       join ${schema}.locations l on l.id = sr.location_id
       join ${schema}.functions f on f.id = sr.function_id
       where sr.id = $1
       for update of sr`,
      [seriesId],
    );

    const series = seriesResult.rows[0];
    if (!series) {
      throw new ScheduleSeriesError(
        "series_not_found",
        "Schedule series not found.",
      );
    }

    const occurrence = getSeriesRowOccurrences(series).find(
      (candidate) => candidate.date === occurrenceDate,
    );
    if (!occurrence) {
      throw new ScheduleSeriesError(
        "series_invalid",
        "Occurrence is not part of the schedule series.",
      );
    }

    const scheduleResult = await client.query<{ id: string; status: string }>(
      `select id, status
       from ${schema}.schedules
       where series_id = $1
         and series_occurrence_date = $2::date
       for update`,
      [seriesId, occurrenceDate],
    );
    const schedule = scheduleResult.rows[0] ?? null;

    if (input.skipped) {
      await client.query(
        `insert into ${schema}.schedule_series_exceptions (
          series_id,
          occurrence_date,
          note
        )
        values ($1, $2, $3)
        on conflict (series_id, occurrence_date)
        do update set note = excluded.note`,
        [seriesId, occurrenceDate, note],
      );

      if (schedule && schedule.status !== "cancelled") {
        await client.query(
          `update ${schema}.schedules
           set status = 'cancelled',
               cancelled_reason = $2,
               cancelled_at = now(),
               updated_at = now()
           where id = $1`,
          [schedule.id, note ?? "Data pulada na serie"],
        );

        await client.query(
          `update ${schema}.assignments a
           set status = 'cancelled',
               updated_at = now()
           from ${schema}.schedule_slots ss
           where ss.schedule_id = $1
             and a.schedule_slot_id = ss.id
             and a.status <> 'cancelled'`,
          [schedule.id],
        );

        await client.query(
          `update ${schema}.replacement_requests rr
           set status = 'cancelled',
               updated_at = now()
           from ${schema}.assignments a
           join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
           where ss.schedule_id = $1
             and rr.assignment_id = a.id
             and rr.status in (
               'requested',
               'under_review',
               'waiting_response',
               'accepted'
             )`,
          [schedule.id],
        );
      }
    } else {
      await client.query(
        `delete from ${schema}.schedule_series_exceptions
         where series_id = $1
           and occurrence_date = $2::date`,
        [seriesId, occurrenceDate],
      );

      if (!schedule) {
        const restoredScheduleResult = await client.query<{ id: string }>(
          `insert into ${schema}.schedules (
            series_id,
            series_occurrence_date,
            location_id,
            title,
            starts_at,
            ends_at,
            meeting_point,
            instructions
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          returning id`,
          [
            seriesId,
            occurrenceDate,
            series.location_id,
            series.title,
            occurrence.startsAt.toISOString(),
            occurrence.endsAt.toISOString(),
            series.meeting_point,
            series.instructions,
          ],
        );
        const restoredSchedule = restoredScheduleResult.rows[0];
        if (!restoredSchedule) {
          throw new Error("Restored occurrence insert did not return a row");
        }

        await client.query(
          `insert into ${schema}.schedule_slots (
            schedule_id,
            function_id,
            required_count
          )
          values ($1, $2, $3)`,
          [restoredSchedule.id, series.function_id, series.required_count],
        );
      } else if (schedule.status === "cancelled") {
        await client.query(
          `update ${schema}.schedules
           set status = 'draft',
               cancelled_reason = null,
               cancelled_at = null,
               updated_at = now()
           where id = $1`,
          [schedule.id],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const series = (await listScheduleSeries(schema)).find(
    (candidate) => candidate.id === seriesId,
  );
  if (!series) {
    throw new ScheduleSeriesError(
      "series_not_found",
      "Schedule series not found.",
    );
  }

  return series;
}

export async function cancelScheduleSeries(
  schema: string,
  seriesId: string,
  input: CancelScheduleSeriesInput,
): Promise<CancelScheduleSeriesResult> {
  const client = await pool.connect();
  const note = normalizeOptionalText(input.note);

  try {
    await client.query("begin");

    const seriesResult = await client.query<ScheduleSeriesRow>(
      `select
         sr.id,
         sr.title,
         sr.status,
         sr.anchor_starts_at,
         sr.anchor_ends_at,
         sr.recurrence_interval_weeks,
         sr.recurrence_ends_on,
         sr.required_count,
         sr.meeting_point,
         sr.instructions,
         sr.created_at,
         l.id as location_id,
         l.name as location_name,
         f.id as function_id,
         f.name as function_name
       from ${schema}.schedule_series sr
       join ${schema}.locations l on l.id = sr.location_id
       join ${schema}.functions f on f.id = sr.function_id
       where sr.id = $1
       for update of sr`,
      [seriesId],
    );

    const series = seriesResult.rows[0];
    if (!series) {
      throw new ScheduleSeriesError(
        "series_not_found",
        "Schedule series not found.",
      );
    }

    if (series.status === "archived") {
      throw new ScheduleSeriesError(
        "series_already_archived",
        "Schedule series is already archived.",
      );
    }

    const occurrenceDates = getSeriesRowOccurrences(series)
      .filter((occurrence) => occurrence.date >= input.cancelFrom)
      .map((occurrence) => occurrence.date);

    if (occurrenceDates.length === 0) {
      throw new ScheduleSeriesError(
        "series_invalid",
        "Cancellation date does not reach any occurrence.",
      );
    }

    for (const occurrenceDate of occurrenceDates) {
      await client.query(
        `insert into ${schema}.schedule_series_exceptions (
          series_id,
          occurrence_date,
          note
        )
        values ($1, $2, $3)
        on conflict (series_id, occurrence_date)
        do update set note = excluded.note`,
        [seriesId, occurrenceDate, note],
      );
    }

    const cancelledScheduleResult = await client.query<{ id: string }>(
      `update ${schema}.schedules
       set status = 'cancelled',
           cancelled_reason = $3,
           cancelled_at = now(),
           updated_at = now()
       where series_id = $1
         and series_occurrence_date >= $2::date
         and status in ('draft', 'published')
       returning id`,
      [seriesId, input.cancelFrom, note ?? "Serie encerrada"],
    );
    const scheduleIds = cancelledScheduleResult.rows.map((row) => row.id);

    let cancelledAssignments = 0;
    let cancelledReplacementRequests = 0;

    if (scheduleIds.length > 0) {
      const cancelledAssignmentResult = await client.query<{ id: string }>(
        `update ${schema}.assignments a
         set status = 'cancelled',
             updated_at = now()
         from ${schema}.schedule_slots ss
         where ss.schedule_id = any($1::uuid[])
           and a.schedule_slot_id = ss.id
           and a.status <> 'cancelled'
         returning a.id`,
        [scheduleIds],
      );
      cancelledAssignments = cancelledAssignmentResult.rowCount ?? 0;

      const cancelledReplacementRequestResult = await client.query<{
        id: string;
      }>(
        `update ${schema}.replacement_requests rr
         set status = 'cancelled',
             updated_at = now()
         from ${schema}.assignments a
         join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
         where ss.schedule_id = any($1::uuid[])
           and rr.assignment_id = a.id
           and rr.status in (
             'requested',
             'under_review',
             'waiting_response',
             'accepted'
           )
         returning rr.id`,
        [scheduleIds],
      );
      cancelledReplacementRequests =
        cancelledReplacementRequestResult.rowCount ?? 0;
    }

    await client.query(
      `update ${schema}.schedule_series
       set status = 'archived',
           updated_at = now()
       where id = $1`,
      [seriesId],
    );

    await client.query("commit");

    return {
      seriesId,
      status: "archived",
      cancelFrom: input.cancelFrom,
      cancelledSchedules: scheduleIds.length,
      cancelledAssignments,
      cancelledReplacementRequests,
      skippedOccurrences: occurrenceDates.length,
    };
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

export async function createScheduleAssignment(
  schema: string,
  scheduleId: string,
  input: CreateScheduleAssignmentInput,
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

export async function inviteReplacementCandidate(
  schema: string,
  replacementRequestId: string,
  personId: string,
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

    await client.query(
      `insert into ${schema}.assignments (
        schedule_slot_id,
        assignee_type,
        assignee_id,
        status,
        replacement_request_id
      )
      values ($1, 'person', $2, 'invited', $3)`,
      [replacementRequest.schedule_slot_id, personId, replacementRequestId],
    );

    await client.query(
      `update ${schema}.replacement_requests
       set status = 'waiting_response',
           updated_at = now()
       where id = $1`,
      [replacementRequestId],
    );

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

    if (!candidateResult.rows[0]) {
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
    await ensureReplacementRequestAssignmentLink(client, schema);

    const assignmentResult = await client.query<{
      id: string;
      replacement_request_id: string | null;
      schedule_slot_id: string;
      status: string;
    }>(
      `select a.id, a.replacement_request_id, a.schedule_slot_id, a.status
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

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return listMemberSchedules(schema, personId);
}

export async function createReplacementRequest(
  schema: string,
  personId: string,
  assignmentId: string,
  input: CreateReplacementRequestInput,
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

    await client.query(
      `insert into ${schema}.replacement_requests (
         assignment_id,
         requested_by_person_id,
         reason,
         urgent
       )
       values ($1, $2, $3, $4)`,
      [assignmentId, personId, input.reason ?? null, input.urgent ?? false],
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
