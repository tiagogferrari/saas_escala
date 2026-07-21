export type ScheduleDraftRow = {
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

export type ScheduleSeriesRow = {
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

export type ScheduleSeriesScheduleRow = {
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
  cancelled_reason: string | null;
  cancelled_at: Date | null;
  assignment_count: string;
};

export type ScheduleSeriesExistingScheduleRow = {
  id: string;
  occurrence_date: Date;
  status: string;
  title: string;
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

export type ScheduleSeriesOccurrenceDetailsScheduleRow = {
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
  effective_assignment_count: string;
};

export type ScheduleSeriesExceptionRow = {
  series_id: string;
  occurrence_date: Date;
  note: string | null;
};

export type ScheduleAssignmentRow = {
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

export type MemberScheduleRow = {
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
