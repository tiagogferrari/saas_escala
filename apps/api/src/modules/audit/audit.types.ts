export type AuditActor =
  | {
      type: "manager";
      userId: string;
      displayName?: string;
    }
  | {
      type: "member";
      personId: string;
      displayName?: string;
    }
  | {
      type: "system";
      displayName?: string;
    };

export type AuditAction =
  | "assignment.created"
  | "assignment.responded"
  | "schedule_occurrence.restored"
  | "schedule_occurrence.skipped"
  | "schedule_occurrence.updated"
  | "replacement.candidate_invited"
  | "replacement.completed"
  | "replacement.requested"
  | "schedule.cancelled"
  | "schedule.created"
  | "schedule.published"
  | "schedule_series.archived"
  | "schedule_series.created"
  | "schedule_series.updated";

export type RecordAuditEventInput = {
  actor?: AuditActor;
  action: AuditAction;
  entityType: "schedule" | "schedule_series";
  entityId: string;
  context?: Record<string, unknown>;
};

export type ListAuditEventsInput = {
  action?: string;
  entityType?: string;
  entityId?: string;
  before?: string;
  limit: number;
};

export type AuditEvent = {
  id: string;
  actor: {
    type: AuditActor["type"];
    id: string | null;
    displayName: string;
  };
  action: string;
  entity: {
    type: string;
    id: string | null;
  };
  context: Record<string, unknown>;
  createdAt: string;
};
