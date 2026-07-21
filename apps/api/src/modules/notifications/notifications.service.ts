import { quoteIdentifier } from "../../shared/db/identifiers";
import { createMemberAccessToken } from "../member-access/member-access.repository";
import type { Tenant } from "../tenants/tenants.types";
import { listActiveTenants } from "../tenants/tenants.repository";
import { pool } from "../../shared/db/pool";
import { sendEmail } from "./email.sender";
import { NotificationError } from "./notifications.errors";
import {
  buildNotificationEmail,
  createMemberAccessUrl,
  getInvitationSubject,
  getReminderSubject,
} from "./notifications.email";
import { buildCandidatesQuery } from "./notifications.queries";
import type {
  NotificationCandidate,
  NotificationDispatchSummary,
  NotificationKind,
  QueuedNotification,
  QueueResult,
} from "./notifications.types";

export { NotificationError } from "./notifications.errors";
export type {
  NotificationDispatchSummary,
  NotificationErrorCode,
  NotificationKind,
} from "./notifications.types";

function emptySummary(): NotificationDispatchSummary {
  return {
    failed: 0,
    queued: 0,
    sent: 0,
    skippedNoEmail: 0,
  };
}

async function queueCandidates(
  schema: string,
  candidates: NotificationCandidate[],
  kind: NotificationKind,
  options: { manual?: boolean } = {},
): Promise<QueueResult> {
  const result: QueueResult = {
    ...emptySummary(),
    notificationIds: [],
  };

  for (const candidate of candidates) {
    if (!candidate.recipient_email) {
      result.skippedNoEmail += 1;
      continue;
    }

    const subject =
      kind === "schedule_invitation"
        ? getInvitationSubject(candidate)
        : getReminderSubject(candidate);
    const deliveryKey = options.manual
      ? null
      : `${kind}:${candidate.assignment_id}`;
    const notification = await pool.query<{ id: string }>(
      `insert into ${schema}.notification_deliveries (
        assignment_id,
        person_id,
        kind,
        delivery_key,
        recipient_email,
        subject
      )
      values ($1, $2, $3, $4, $5, $6)
      on conflict (delivery_key) do nothing
      returning id`,
      [
        candidate.assignment_id,
        candidate.person_id,
        kind,
        deliveryKey,
        candidate.recipient_email,
        subject,
      ],
    );

    const notificationId = notification.rows[0]?.id;
    if (notificationId) {
      result.notificationIds.push(notificationId);
      result.queued += 1;
    }
  }

  return result;
}

async function dispatchQueuedNotifications(
  schema: string,
  tenant: Tenant,
  notificationIds: string[],
) {
  const summary = emptySummary();
  if (notificationIds.length === 0) {
    return summary;
  }

  const notifications = await pool.query<QueuedNotification>(
    `select
       nd.id,
       nd.kind,
       nd.subject,
       nd.assignment_id,
       nd.person_id,
       nd.recipient_email,
       p.display_name as person_name,
       s.title as schedule_title,
       s.starts_at,
       s.ends_at,
       l.name as location_name,
       f.name as function_name
     from ${schema}.notification_deliveries nd
     join ${schema}.people p on p.id = nd.person_id
     join ${schema}.assignments a on a.id = nd.assignment_id
     join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
     join ${schema}.schedules s on s.id = ss.schedule_id
     join ${schema}.locations l on l.id = s.location_id
     join ${schema}.functions f on f.id = ss.function_id
     where nd.id = any($1::uuid[])
       and nd.status = 'queued'
     order by nd.created_at asc`,
    [notificationIds],
  );

  for (const notification of notifications.rows) {
    try {
      const access = await createMemberAccessToken(
        schema,
        notification.person_id,
      );
      const memberAccessUrl = createMemberAccessUrl(tenant.slug, access.token);
      const email = buildNotificationEmail(
        tenant,
        notification,
        memberAccessUrl,
      );

      await sendEmail({
        to: notification.recipient_email,
        subject: notification.subject,
        ...email,
      });

      await pool.query(
        `update ${schema}.notification_deliveries
         set status = 'sent',
             sent_at = now(),
             updated_at = now(),
             failure_reason = null
         where id = $1`,
        [notification.id],
      );
      summary.sent += 1;
    } catch (error) {
      await pool.query(
        `update ${schema}.notification_deliveries
         set status = 'failed',
             failure_reason = $2,
             updated_at = now()
         where id = $1`,
        [
          notification.id,
          error instanceof Error ? error.message.slice(0, 500) : "Email failed",
        ],
      );
      summary.failed += 1;
    }
  }

  return summary;
}

function combineSummaries(
  queued: QueueResult,
  dispatched: NotificationDispatchSummary,
) {
  return {
    queued: queued.queued,
    skippedNoEmail: queued.skippedNoEmail,
    sent: dispatched.sent,
    failed: dispatched.failed,
  } satisfies NotificationDispatchSummary;
}

export async function sendScheduleInvitations(
  schema: string,
  tenant: Tenant,
  scheduleId: string,
) {
  const candidates = await pool.query<NotificationCandidate>(
    buildCandidatesQuery(schema, "s.id = $1"),
    [scheduleId],
  );
  const queued = await queueCandidates(
    schema,
    candidates.rows,
    "schedule_invitation",
  );
  const dispatched = await dispatchQueuedNotifications(
    schema,
    tenant,
    queued.notificationIds,
  );

  return combineSummaries(queued, dispatched);
}

export async function resendScheduleInvitation(
  schema: string,
  tenant: Tenant,
  assignmentId: string,
) {
  const candidates = await pool.query<NotificationCandidate>(
    buildCandidatesQuery(schema, "a.id = $1"),
    [assignmentId],
  );
  const candidate = candidates.rows[0];
  if (!candidate) {
    throw new NotificationError(
      "assignment_not_invitable",
      "Assignment is not available for an invitation.",
    );
  }

  if (!candidate.recipient_email) {
    throw new NotificationError(
      "person_without_email",
      "Person does not have an email address.",
    );
  }

  const queued = await queueCandidates(
    schema,
    [candidate],
    "schedule_invitation",
    { manual: true },
  );
  const dispatched = await dispatchQueuedNotifications(
    schema,
    tenant,
    queued.notificationIds,
  );

  return combineSummaries(queued, dispatched);
}

async function sendDueScheduleRemindersForTenant(tenant: Tenant) {
  const schema = quoteIdentifier(tenant.schemaName);
  const candidates = await pool.query<NotificationCandidate>(
    buildCandidatesQuery(
      schema,
      "s.starts_at > now() and s.starts_at <= now() + interval '24 hours'",
    ),
  );
  const queued = await queueCandidates(
    schema,
    candidates.rows,
    "schedule_reminder_24h",
  );
  const dispatched = await dispatchQueuedNotifications(
    schema,
    tenant,
    queued.notificationIds,
  );

  return combineSummaries(queued, dispatched);
}

export async function sendDueScheduleReminders() {
  const tenants = await listActiveTenants();

  return Promise.all(
    tenants.map((tenant) => sendDueScheduleRemindersForTenant(tenant)),
  );
}
