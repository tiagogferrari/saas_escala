import type { Tenant } from "../tenants/tenants.types";
import type {
  NotificationCandidate,
  QueuedNotification,
} from "./notifications.types";

function getAppUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function getInvitationSubject(candidate: NotificationCandidate) {
  return `Convite para a escala ${candidate.schedule_title}`;
}

export function getReminderSubject(candidate: NotificationCandidate) {
  return `Lembrete: confirme a escala ${candidate.schedule_title}`;
}

function formatScheduleDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function escapeHtmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createMemberAccessUrl(tenantSlug: string, token: string) {
  const url = new URL(getAppUrl());
  url.searchParams.set("tenant", tenantSlug);
  url.searchParams.set("memberToken", token);
  return url.toString();
}

export function buildNotificationEmail(
  tenant: Tenant,
  notification: QueuedNotification,
  memberAccessUrl: string,
) {
  const isReminder = notification.kind === "schedule_reminder_24h";
  const opening = isReminder
    ? "Este e um lembrete para responder sua escala."
    : "Voce foi convidado para uma escala.";
  const action = isReminder ? "Confirmar ou recusar" : "Responder ao convite";
  const scheduleDate = formatScheduleDate(notification.starts_at);
  const text = [
    `Ola, ${notification.person_name}.`,
    "",
    opening,
    `Escala: ${notification.schedule_title}`,
    `Funcao: ${notification.function_name}`,
    `Data: ${scheduleDate}`,
    `Local: ${notification.location_name}`,
    "",
    `${action}: ${memberAccessUrl}`,
    "",
    tenant.displayName,
  ].join("\n");

  const html = `
    <p>Ola, ${escapeHtmlText(notification.person_name)}.</p>
    <p>${escapeHtmlText(opening)}</p>
    <p>
      <strong>Escala:</strong> ${escapeHtmlText(notification.schedule_title)}<br />
      <strong>Funcao:</strong> ${escapeHtmlText(notification.function_name)}<br />
      <strong>Data:</strong> ${escapeHtmlText(scheduleDate)}<br />
      <strong>Local:</strong> ${escapeHtmlText(notification.location_name)}
    </p>
    <p><a href="${escapeHtmlText(memberAccessUrl)}">${escapeHtmlText(action)}</a></p>
    <p>${escapeHtmlText(tenant.displayName)}</p>
  `;

  return {
    text,
    html,
  };
}
