export type NotificationKind = "schedule_invitation" | "schedule_reminder_24h";

export type NotificationCandidate = {
  assignment_id: string;
  person_id: string;
  recipient_email: string | null;
  person_name: string;
  schedule_title: string;
  starts_at: Date;
  ends_at: Date;
  location_name: string;
  function_name: string;
};

export type QueuedNotification = Omit<
  NotificationCandidate,
  "recipient_email"
> & {
  id: string;
  kind: NotificationKind;
  recipient_email: string;
  subject: string;
};

export type NotificationDispatchSummary = {
  failed: number;
  queued: number;
  sent: number;
  skippedNoEmail: number;
};

export type QueueResult = NotificationDispatchSummary & {
  notificationIds: string[];
};

export type NotificationErrorCode =
  | "assignment_not_invitable"
  | "person_without_email";
