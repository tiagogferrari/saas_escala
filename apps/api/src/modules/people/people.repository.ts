import { pool } from "../../shared/db/pool";
import type { CreatePersonInput, Person } from "./people.types";

export type { CreatePersonInput, Person } from "./people.types";

type PersonRow = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: Date;
};

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createPerson(schema: string, input: CreatePersonInput) {
  const result = await pool.query<PersonRow>(
    `insert into ${schema}.people (display_name, email, phone)
     values ($1, $2, $3)
     returning id, display_name, email, phone, status, created_at`,
    [input.displayName, input.email ?? null, input.phone ?? null],
  );

  const person = result.rows[0];
  if (!person) {
    throw new Error("Person insert did not return a row");
  }

  return mapPerson(person);
}

export async function listPeople(schema: string) {
  const result = await pool.query<PersonRow>(
    `select id, display_name, email, phone, status, created_at
     from ${schema}.people
     order by display_name asc`,
  );

  return result.rows.map(mapPerson);
}
