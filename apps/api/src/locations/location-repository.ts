import { pool } from "../db/pool";

export type Location = {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  createdAt: string;
};

export type CreateLocationInput = {
  name: string;
  address?: string | null;
  timezone?: string | null;
};

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  created_at: Date;
};

function mapLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    timezone: row.timezone,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createLocation(
  schema: string,
  input: CreateLocationInput,
) {
  const result = await pool.query<LocationRow>(
    `insert into ${schema}.locations (name, address, timezone)
     values ($1, $2, $3)
     returning id, name, address, timezone, created_at`,
    [input.name, input.address ?? null, input.timezone ?? null],
  );

  const location = result.rows[0];
  if (!location) {
    throw new Error("Location insert did not return a row");
  }

  return mapLocation(location);
}

export async function listLocations(schema: string) {
  const result = await pool.query<LocationRow>(
    `select id, name, address, timezone, created_at
     from ${schema}.locations
     order by name asc`,
  );

  return result.rows.map(mapLocation);
}
