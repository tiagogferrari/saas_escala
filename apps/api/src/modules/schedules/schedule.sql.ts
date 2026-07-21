export const scheduleSummarySelect = `
select
  s.id as schedule_id,
  s.series_id,
  s.series_occurrence_date,
  s.title,
  s.status,
  s.starts_at,
  s.ends_at,
  s.meeting_point,
  s.instructions,
  s.cancelled_reason,
  s.cancelled_at,
  l.id as location_id,
  l.name as location_name,
  ss.id as slot_id,
  f.id as function_id,
  f.name as function_name,
  ss.required_count,
  s.created_at
`;

export const assignmentSummarySelect = `
select
  a.id,
  a.schedule_slot_id,
  a.assignee_type,
  a.assignee_id,
  coalesce(p.display_name, g.name, 'Sem nome') as assignee_name,
  a.status,
  a.confirmed_at,
  a.confirmation_source,
  a.created_at,
  a.replacement_request_id as linked_replacement_request_id,
  rr.id as replacement_request_id,
  rr.requested_by_person_id as replacement_requested_by_person_id,
  rr.status as replacement_request_status,
  rr.reason as replacement_request_reason,
  rr.urgent as replacement_request_urgent,
  rr.created_at as replacement_request_created_at,
  rr.updated_at as replacement_request_updated_at,
  nd.kind as notification_kind,
  nd.status as notification_status,
  nd.sent_at as notification_sent_at,
  nd.recipient_email as notification_recipient_email
`;

export function replacementRequestJoin(schema: string) {
  return `
     left join lateral (
       select
         rr.id,
         rr.requested_by_person_id,
         rr.status,
         rr.reason,
         rr.urgent,
         rr.created_at,
         rr.updated_at
       from ${schema}.replacement_requests rr
       where rr.assignment_id = a.id
         and rr.status in ('requested', 'under_review', 'waiting_response', 'accepted', 'completed')
       order by rr.created_at desc
       limit 1
     ) rr on true`;
}

export function notificationDeliveryJoin(schema: string) {
  return `
     left join lateral (
       select
         nd.kind,
         nd.status,
         nd.sent_at,
         nd.recipient_email
       from ${schema}.notification_deliveries nd
       where nd.assignment_id = a.id
       order by nd.created_at desc
       limit 1
     ) nd on true`;
}
