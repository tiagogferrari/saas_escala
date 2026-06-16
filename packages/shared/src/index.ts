export type TenantStatus = "active" | "pending_deletion" | "removed";

export type MembershipStatus = "active" | "paused" | "inactive";

export type ScheduleStatus = "draft" | "published" | "cancelled" | "completed";

export type AssignmentStatus =
  | "invited"
  | "pending"
  | "confirmed"
  | "externally_confirmed"
  | "declined"
  | "expired"
  | "cancelled";

export type ReplacementStatus =
  | "requested"
  | "under_review"
  | "waiting_response"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled"
  | "completed";

export type AttendanceStatus =
  | "not_recorded"
  | "attended"
  | "missed"
  | "excused_or_cancelled";
