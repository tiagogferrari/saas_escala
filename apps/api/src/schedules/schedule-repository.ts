import { pool } from "../db/pool";

export type ScheduleDraft = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  meetingPoint: string | null;
  instructions: string | null;
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
  createdAt: string;
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

type ScheduleDraftRow = {
  schedule_id: string;
  title: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  meeting_point: string | null;
  instructions: string | null;
  location_id: string;
  location_name: string;
  slot_id: string;
  function_id: string;
  function_name: string;
  required_count: number;
  created_at: Date;
};

function mapScheduleDraft(row: ScheduleDraftRow): ScheduleDraft {
  return {
    id: row.schedule_id,
    title: row.title,
    status: row.status,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    meetingPoint: row.meeting_point,
    instructions: row.instructions,
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
    createdAt: row.created_at.toISOString(),
  };
}

const scheduleSummarySelect = `
select
  s.id as schedule_id,
  s.title,
  s.status,
  s.starts_at,
  s.ends_at,
  s.meeting_point,
  s.instructions,
  l.id as location_id,
  l.name as location_name,
  ss.id as slot_id,
  f.id as function_id,
  f.name as function_name,
  ss.required_count,
  s.created_at
`;

export async function createScheduleDraft(
  schema: string,
  input: CreateScheduleDraftInput,
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

    await client.query("commit");
    return mapScheduleDraft(summary);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listScheduleDrafts(schema: string) {
  const result = await pool.query<ScheduleDraftRow>(
    `${scheduleSummarySelect}
     from ${schema}.schedules s
     join ${schema}.locations l on l.id = s.location_id
     join ${schema}.schedule_slots ss on ss.schedule_id = s.id
     join ${schema}.functions f on f.id = ss.function_id
     order by s.starts_at asc, s.created_at asc
     limit 100`,
  );

  return result.rows.map(mapScheduleDraft);
}
