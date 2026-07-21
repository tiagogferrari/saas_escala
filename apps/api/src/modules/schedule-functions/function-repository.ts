import { pool } from "../../shared/db/pool";

export type ScheduleFunction = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
};

export type CreateScheduleFunctionInput = {
  name: string;
  description?: string | null;
};

type ScheduleFunctionRow = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: Date;
};

function mapScheduleFunction(row: ScheduleFunctionRow): ScheduleFunction {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createScheduleFunction(
  schema: string,
  input: CreateScheduleFunctionInput,
) {
  const result = await pool.query<ScheduleFunctionRow>(
    `insert into ${schema}.functions (name, description)
     values ($1, $2)
     returning id, name, description, is_default, created_at`,
    [input.name, input.description ?? null],
  );

  const scheduleFunction = result.rows[0];
  if (!scheduleFunction) {
    throw new Error("Function insert did not return a row");
  }

  return mapScheduleFunction(scheduleFunction);
}

export async function listScheduleFunctions(schema: string) {
  const result = await pool.query<ScheduleFunctionRow>(
    `select id, name, description, is_default, created_at
     from ${schema}.functions
     order by is_default desc, name asc`,
  );

  return result.rows.map(mapScheduleFunction);
}

