import {
  auditActions,
  recordAuditEvent,
  systemAuditActor,
  type AuditActor,
} from "../audit/audit-repository";
import { pool } from "../../shared/db/pool";
import { SchedulePublicationError } from "./schedule.errors";
import { mapScheduleDraft } from "./schedule.mappers";
import type { ScheduleDraftRow } from "./schedule.rows";
import { scheduleSummarySelect } from "./schedule.sql";
import type { CreateScheduleDraftInput } from "./schedule.types";
import { getScheduleDraftById } from "./schedule-query.service";

export { SchedulePublicationError } from "./schedule.errors";
export async function createScheduleDraft(
  schema: string,
  input: CreateScheduleDraftInput,
  actor: AuditActor = systemAuditActor,
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

    await recordAuditEvent(client, schema, {
      actor,
      action: auditActions.scheduleCreated,
      entityType: "schedule",
      entityId: schedule.id,
      context: {
        title: input.title,
        locationId: input.locationId,
        functionId: input.functionId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        requiredCount: input.requiredCount,
      },
    });

    await client.query("commit");
    return mapScheduleDraft(summary);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function publishSchedule(
  schema: string,
  scheduleId: string,
  actor: AuditActor = systemAuditActor,
) {
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
       limit 1
       for update of s, ss`,
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

      await recordAuditEvent(client, schema, {
        actor,
        action: auditActions.schedulePublished,
        entityType: "schedule",
        entityId: scheduleId,
        context: {
          previousStatus: schedule.status,
          requiredCount: schedule.required_count,
        },
      });
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
