import {
  auditActions,
  recordAuditEvent,
  systemAuditActor,
  type AuditActor,
} from "../audit/audit.repository";
import { pool } from "../../shared/db/pool";
import {
  ScheduleCancellationError,
  ScheduleSeriesError,
} from "./schedule.errors";
import { getSeriesRowOccurrences } from "./recurrence.helpers";
import type { ScheduleSeriesRow } from "./schedule.rows";
import type {
  CancelScheduleInput,
  CancelScheduleResult,
  CancelScheduleSeriesInput,
  CancelScheduleSeriesResult,
} from "./schedule.types";
import { getScheduleDraftById } from "./schedule-query.service";
import { normalizeOptionalText } from "./schedule.utils";

export {
  ScheduleCancellationError,
  ScheduleSeriesError,
} from "./schedule.errors";
export async function cancelScheduleSeries(
  schema: string,
  seriesId: string,
  input: CancelScheduleSeriesInput,
  actor: AuditActor = systemAuditActor,
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

    await recordAuditEvent(client, schema, {
      actor,
      action: auditActions.seriesArchived,
      entityType: "schedule_series",
      entityId: seriesId,
      context: {
        cancelFrom: input.cancelFrom,
        note,
        cancelledSchedules: scheduleIds.length,
        cancelledAssignments,
        cancelledReplacementRequests,
        skippedOccurrences: occurrenceDates.length,
      },
    });

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

export async function cancelSchedule(
  schema: string,
  scheduleId: string,
  input: CancelScheduleInput,
  actor: AuditActor = systemAuditActor,
): Promise<CancelScheduleResult> {
  const client = await pool.connect();
  const reason = input.reason.trim();
  let cancelledAssignments = 0;
  let cancelledReplacementRequests = 0;

  try {
    await client.query("begin");

    const scheduleResult = await client.query<{ status: string }>(
      `select status
       from ${schema}.schedules
       where id = $1
       for update`,
      [scheduleId],
    );
    const schedule = scheduleResult.rows[0];

    if (!schedule) {
      throw new ScheduleCancellationError(
        "schedule_not_found",
        "Schedule not found.",
      );
    }

    if (schedule.status === "cancelled") {
      throw new ScheduleCancellationError(
        "schedule_already_cancelled",
        "Schedule is already cancelled.",
      );
    }

    if (schedule.status !== "published") {
      throw new ScheduleCancellationError(
        "schedule_not_published",
        "Only published schedules can be cancelled.",
      );
    }

    await client.query(
      `update ${schema}.schedules
       set status = 'cancelled',
           cancelled_reason = $2,
           cancelled_at = now(),
           updated_at = now()
       where id = $1`,
      [scheduleId, reason],
    );

    const cancelledAssignmentResult = await client.query<{ id: string }>(
      `update ${schema}.assignments a
       set status = 'cancelled',
           updated_at = now()
       from ${schema}.schedule_slots ss
       where ss.schedule_id = $1
         and a.schedule_slot_id = ss.id
         and a.status <> 'cancelled'
       returning a.id`,
      [scheduleId],
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
       where ss.schedule_id = $1
         and rr.assignment_id = a.id
         and rr.status in (
           'requested',
           'under_review',
           'waiting_response',
           'accepted'
         )
       returning rr.id`,
      [scheduleId],
    );
    cancelledReplacementRequests =
      cancelledReplacementRequestResult.rowCount ?? 0;

    await recordAuditEvent(client, schema, {
      actor,
      action: auditActions.scheduleCancelled,
      entityType: "schedule",
      entityId: scheduleId,
      context: {
        reason,
        previousStatus: schedule.status,
        cancelledAssignments,
        cancelledReplacementRequests,
      },
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return {
    schedule: await getScheduleDraftById(schema, scheduleId),
    cancelledAssignments,
    cancelledReplacementRequests,
  };
}
