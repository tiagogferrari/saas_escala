import { getSeriesRowOccurrences } from "./recurrence.helpers";
import type {
  MemberScheduleRow,
  ScheduleAssignmentRow,
  ScheduleDraftRow,
  ScheduleSeriesExceptionRow,
  ScheduleSeriesRow,
  ScheduleSeriesScheduleRow,
} from "./schedule.rows";
import type {
  MemberSchedule,
  NotificationDelivery,
  ReplacementRequest,
  ScheduleAssignment,
  ScheduleDraft,
  ScheduleSeriesOverview,
} from "./schedule.types";
import { getDateKey } from "./schedule.utils";

export function mapScheduleDraft(row: ScheduleDraftRow): ScheduleDraft {
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

export function mapMemberSchedule(
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

export function mapScheduleAssignment(
  row: ScheduleAssignmentRow,
): ScheduleAssignment {
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

export function mapScheduleSeriesOverview(
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
      cancelledReason: schedule?.cancelled_reason ?? null,
      cancelledAt: schedule?.cancelled_at?.toISOString() ?? null,
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

export function addScheduleSeriesScheduleToMap(
  schedulesBySeries: Map<string, Map<string, ScheduleSeriesScheduleRow>>,
  row: ScheduleSeriesScheduleRow,
) {
  const date = getDateKey(row.occurrence_date);
  const schedulesByDate = schedulesBySeries.get(row.series_id) ?? new Map();
  schedulesByDate.set(date, row);
  schedulesBySeries.set(row.series_id, schedulesByDate);
}

export function addScheduleSeriesExceptionToMap(
  exceptionsBySeries: Map<string, Map<string, string | null>>,
  row: ScheduleSeriesExceptionRow,
) {
  const date = getDateKey(row.occurrence_date);
  const exceptionsByDate = exceptionsBySeries.get(row.series_id) ?? new Map();
  exceptionsByDate.set(date, row.note);
  exceptionsBySeries.set(row.series_id, exceptionsByDate);
}
