export function buildCandidatesQuery(schema: string, condition: string) {
  return `
    select
      a.id as assignment_id,
      p.id as person_id,
      p.email as recipient_email,
      p.display_name as person_name,
      s.title as schedule_title,
      s.starts_at,
      s.ends_at,
      l.name as location_name,
      f.name as function_name
    from ${schema}.assignments a
    join ${schema}.people p on p.id = a.assignee_id
    join ${schema}.schedule_slots ss on ss.id = a.schedule_slot_id
    join ${schema}.schedules s on s.id = ss.schedule_id
    join ${schema}.locations l on l.id = s.location_id
    join ${schema}.functions f on f.id = ss.function_id
    where a.assignee_type = 'person'
      and a.status in ('invited', 'pending')
      and s.status = 'published'
      and ${condition}
  `;
}
