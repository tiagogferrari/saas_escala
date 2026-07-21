export type ScheduleAssignmentErrorCode =
  | "assignment_already_exists"
  | "person_not_found"
  | "person_unavailable"
  | "schedule_not_assignable"
  | "schedule_not_found"
  | "slot_full";

export type SchedulePublicationErrorCode =
  | "schedule_not_draft"
  | "schedule_not_found";

export type ScheduleCancellationErrorCode =
  | "schedule_already_cancelled"
  | "schedule_not_found"
  | "schedule_not_published";

export type MemberScheduleErrorCode =
  | "assignment_not_actionable"
  | "assignment_not_found"
  | "person_not_found"
  | "replacement_request_already_exists";

export type ReplacementRequestManagerErrorCode =
  | "assignment_already_exists"
  | "person_not_found"
  | "person_unavailable"
  | "replacement_candidate_not_confirmed"
  | "replacement_request_not_found"
  | "replacement_request_not_open"
  | "schedule_not_assignable";

export type ScheduleSeriesErrorCode =
  | "occurrence_capacity_below_assignments"
  | "occurrence_function_locked"
  | "occurrence_not_editable"
  | "occurrence_not_restorable"
  | "occurrence_not_skippable"
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

export class ScheduleCancellationError extends Error {
  constructor(
    public readonly code: ScheduleCancellationErrorCode,
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
