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
  cancelledReason: string | null;
  cancelledAt: string | null;
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

export type CancelScheduleInput = {
  reason: string;
};

export type CancelScheduleResult = {
  schedule: ScheduleDraft;
  cancelledAssignments: number;
  cancelledReplacementRequests: number;
};

export type CreateReplacementRequestInput = {
  reason?: string | null;
  urgent?: boolean;
};
