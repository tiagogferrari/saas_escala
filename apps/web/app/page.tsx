"use client";

import { FormEvent, use, useEffect, useMemo, useState } from "react";
import {
  ScheduleSeriesPanel,
  type ScheduleSeriesCreatePayload,
} from "./schedule-series-panel";
import {
  ScheduleSeriesManager,
  type ScheduleSeriesOccurrenceUpdatePayload,
  type ScheduleSeriesOverview,
} from "./schedule-series-manager";

type Tenant = {
  id: string;
  slug: string;
  displayName: string;
  schemaName: string;
  timezone: string;
  locale: string;
  status: string;
  createdAt: string;
};

type Person = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

type Location = {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  createdAt: string;
};

type ScheduleFunction = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
};

type ReplacementRequest = {
  id: string;
  assignmentId: string;
  requestedByPersonId: string;
  status: string;
  reason: string | null;
  urgent: boolean;
  createdAt: string;
  updatedAt: string;
};

type NotificationDelivery = {
  kind: string;
  status: string;
  sentAt: string | null;
  recipientEmail: string;
};

type NotificationDispatchSummary = {
  failed: number;
  queued: number;
  sent: number;
  skippedNoEmail: number;
};

type ScheduleAssignment = {
  id: string;
  scheduleSlotId: string;
  assigneeType: "person" | "group";
  assigneeId: string;
  assigneeName: string;
  status: string;
  confirmedAt: string | null;
  confirmationSource: string | null;
  replacementRequestId: string | null;
  replacementRequest: ReplacementRequest | null;
  notification: NotificationDelivery | null;
  createdAt: string;
};

type AssignmentInitialStatus = "externally_confirmed" | "invited";

type ScheduleDraft = {
  id: string;
  seriesId: string | null;
  occurrenceDate: string | null;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  meetingPoint: string | null;
  instructions: string | null;
  cancelledReason: string | null;
  cancelledAt: string | null;
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
  assignments: ScheduleAssignment[];
  createdAt: string;
};

type MemberSchedule = {
  assignment: ScheduleAssignment;
  schedule: {
    id: string;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string;
    cancelledReason: string | null;
    cancelledAt: string | null;
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
  };
  companions: ScheduleAssignment[];
};

type MemberAccessPayload = {
  person: Person;
  schedules: MemberSchedule[];
};

type MemberAccessLink = {
  token: string;
  expiresAt: string;
  person: Person;
};

type ApiStatus = "checking" | "online" | "offline";

type AuthState = "checking" | "setup" | "signed_out" | "authenticated";

type ManagerUser = {
  id: string;
  displayName: string;
  email: string;
};

type SetupTenant = {
  slug: string;
  displayName: string;
};

type PageSearchParams = Record<string, string | string[] | undefined>;

type HomePageProps = {
  searchParams: Promise<PageSearchParams>;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

function apiFetch(input: string, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    credentials: "include",
  });
}

function buildMemberAccessUrl(tenantSlug: string, token: string) {
  if (typeof window === "undefined") {
    return `/?tenant=${tenantSlug}&memberToken=${token}`;
  }

  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("tenant", tenantSlug);
  url.searchParams.set("memberToken", token);

  return url.toString();
}

function getSearchParamValue(searchParams: PageSearchParams, name: string) {
  const value = searchParams[name];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatScheduleDay(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    weekday: "long",
  }).format(new Date(value));
}

function formatTimeRange(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(new Date(startsAt))} ate ${formatter.format(
    new Date(endsAt),
  )}`;
}

function toDatetimeLocalInputValue(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function getDefaultScheduleWindow() {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 1);
  startsAt.setHours(8, 0, 0, 0);

  const endsAt = new Date(startsAt);
  endsAt.setHours(startsAt.getHours() + 1);

  return {
    startsAt: toDatetimeLocalInputValue(startsAt),
    endsAt: toDatetimeLocalInputValue(endsAt),
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function scheduleStatusLabel(status: string) {
  if (status === "draft") {
    return "Rascunho";
  }

  if (status === "published") {
    return "Publicado";
  }

  if (status === "cancelled") {
    return "Cancelado";
  }

  if (status === "completed") {
    return "Finalizado";
  }

  return status;
}

function assignmentStatusLabel(status: string) {
  if (status === "externally_confirmed") {
    return "Confirmado pelo gestor";
  }

  if (status === "confirmed") {
    return "Confirmado";
  }

  if (status === "invited") {
    return "Convidado";
  }

  if (status === "pending") {
    return "Aguardando";
  }

  if (status === "declined") {
    return "Recusado";
  }

  if (status === "cancelled") {
    return "Cancelado";
  }

  return status;
}

function notificationDeliveryLabel(notification: NotificationDelivery | null) {
  if (!notification) {
    return "Convite ainda nao enviado";
  }

  if (notification.status === "sent") {
    const label =
      notification.kind === "schedule_reminder_24h"
        ? "Lembrete enviado"
        : "Convite enviado";

    return notification.sentAt
      ? `${label} em ${formatDate(notification.sentAt)}`
      : label;
  }

  if (notification.status === "failed") {
    return "Falha no envio do e-mail";
  }

  return "Convite aguardando envio";
}

function notificationSummaryMessage(summary: NotificationDispatchSummary) {
  const parts: string[] = [];

  if (summary.sent > 0) {
    parts.push(
      summary.sent === 1
        ? "1 convite enviado"
        : `${summary.sent} convites enviados`,
    );
  }

  if (summary.skippedNoEmail > 0) {
    parts.push(
      summary.skippedNoEmail === 1
        ? "1 pessoa sem e-mail"
        : `${summary.skippedNoEmail} pessoas sem e-mail`,
    );
  }

  if (summary.failed > 0) {
    parts.push(
      summary.failed === 1
        ? "1 envio falhou"
        : `${summary.failed} envios falharam`,
    );
  }

  return parts.length > 0 ? `${parts.join(". ")}.` : "Nenhum convite pendente.";
}

function replacementRequestStatusLabel(status: string) {
  if (status === "requested") {
    return "Substituicao solicitada";
  }

  if (status === "under_review") {
    return "Em analise";
  }

  if (status === "waiting_response") {
    return "Aguardando substituto";
  }

  if (status === "accepted") {
    return "Substituto aceito";
  }

  if (status === "declined") {
    return "Pedido recusado";
  }

  if (status === "completed") {
    return "Substituicao concluida";
  }

  return status;
}

function memberAssignmentPillClassName(status: string) {
  const variants = ["pill", "member-assignment-pill"];

  if (["confirmed", "externally_confirmed"].includes(status)) {
    variants.push("is-success");
  } else if (["invited", "pending"].includes(status)) {
    variants.push("is-warning");
  } else if (["declined", "cancelled"].includes(status)) {
    variants.push("is-danger");
  } else {
    variants.push("is-muted");
  }

  return variants.join(" ");
}

function isActiveAssignmentStatus(status: string) {
  return ["invited", "pending", "confirmed", "externally_confirmed"].includes(
    status,
  );
}

function canInviteReplacementCandidate(status: string) {
  return ["requested", "under_review"].includes(status);
}

function getReplacementRequestsById(schedule: ScheduleDraft) {
  const replacementRequestsById = new Map<string, ReplacementRequest>();

  for (const assignment of schedule.assignments) {
    if (assignment.replacementRequest) {
      replacementRequestsById.set(
        assignment.replacementRequest.id,
        assignment.replacementRequest,
      );
    }
  }

  return replacementRequestsById;
}

function countEffectiveAssignments(schedule: ScheduleDraft) {
  const replacementRequestsById = getReplacementRequestsById(schedule);

  return schedule.assignments.filter((assignment) => {
    if (!isActiveAssignmentStatus(assignment.status)) {
      return false;
    }

    if (!assignment.replacementRequestId) {
      return true;
    }

    return (
      replacementRequestsById.get(assignment.replacementRequestId)?.status ===
      "completed"
    );
  }).length;
}

function countReplacementRequestsInProgress(schedule: ScheduleDraft) {
  return schedule.assignments.filter(
    (assignment) =>
      assignment.replacementRequest &&
      assignment.replacementRequest.status !== "completed",
  ).length;
}

function originalReplacementBadgeLabel(replacementRequest: ReplacementRequest) {
  if (replacementRequest.status === "completed") {
    return "Original substituido";
  }

  if (replacementRequest.status === "accepted") {
    return "Original aguardando conclusao";
  }

  return "Original com imprevisto";
}

function replacementCandidateBadgeLabel(
  assignment: ScheduleAssignment,
  replacementRequest: ReplacementRequest | null,
) {
  if (assignment.status === "declined") {
    return "Substituto recusou";
  }

  if (replacementRequest?.status === "completed") {
    return "Substituto final";
  }

  if (
    replacementRequest?.status === "accepted" ||
    assignment.status === "confirmed" ||
    assignment.status === "externally_confirmed"
  ) {
    return "Substituto aceito";
  }

  return "Substituto convidado";
}

function schedulesOverlap(first: ScheduleDraft, second: ScheduleDraft) {
  return (
    new Date(first.startsAt) < new Date(second.endsAt) &&
    new Date(first.endsAt) > new Date(second.startsAt)
  );
}

function personHasActiveOverlap(
  personId: string,
  targetSchedule: ScheduleDraft,
  schedules: ScheduleDraft[],
) {
  return schedules.some(
    (schedule) =>
      schedule.id !== targetSchedule.id &&
      ["draft", "published"].includes(schedule.status) &&
      schedulesOverlap(targetSchedule, schedule) &&
      schedule.assignments.some(
        (assignment) =>
          assignment.assigneeType === "person" &&
          assignment.assigneeId === personId &&
          isActiveAssignmentStatus(assignment.status),
      ),
  );
}

function getReplacementCandidatePeople(
  people: Person[],
  schedules: ScheduleDraft[],
  targetSchedule: ScheduleDraft,
) {
  const activePeopleInSchedule = new Set(
    targetSchedule.assignments
      .filter((assignment) => isActiveAssignmentStatus(assignment.status))
      .map((assignment) => assignment.assigneeId),
  );

  return people.filter(
    (person) =>
      person.status === "active" &&
      !activePeopleInSchedule.has(person.id) &&
      !personHasActiveOverlap(person.id, targetSchedule, schedules),
  );
}

export default function HomePage({ searchParams }: HomePageProps) {
  const initialSearchParams = use(searchParams);
  const initialTenantSlug = getSearchParamValue(initialSearchParams, "tenant");
  const initialMemberAccessToken = getSearchParamValue(
    initialSearchParams,
    "memberToken",
  );

  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [dbStatus, setDbStatus] = useState<ApiStatus>("checking");
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [managerUser, setManagerUser] = useState<ManagerUser | null>(null);
  const [setupTenants, setSetupTenants] = useState<SetupTenant[]>([]);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupTenantSlug, setSetupTenantSlug] = useState("");
  const [setupTenantName, setSetupTenantName] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState<string | null>(
    () => initialTenantSlug || null,
  );
  const [people, setPeople] = useState<Person[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [scheduleFunctions, setScheduleFunctions] = useState<
    ScheduleFunction[]
  >([]);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [scheduleSeries, setScheduleSeries] = useState<
    ScheduleSeriesOverview[]
  >([]);

  const [displayName, setDisplayName] = useState("Piloto Marcelo");
  const [slug, setSlug] = useState("piloto-marcelo");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("Abertura");
  const [scheduleLocationId, setScheduleLocationId] = useState("");
  const [scheduleFunctionId, setScheduleFunctionId] = useState("");
  const [scheduleStartsAt, setScheduleStartsAt] = useState(
    () => getDefaultScheduleWindow().startsAt,
  );
  const [scheduleEndsAt, setScheduleEndsAt] = useState(
    () => getDefaultScheduleWindow().endsAt,
  );
  const [scheduleRequiredCount, setScheduleRequiredCount] = useState(1);
  const [assignmentScheduleId, setAssignmentScheduleId] = useState("");
  const [assignmentPersonId, setAssignmentPersonId] = useState("");
  const [assignmentStatus, setAssignmentStatus] =
    useState<AssignmentInitialStatus>("externally_confirmed");
  const [memberPersonId, setMemberPersonId] = useState("");
  const [memberAccessToken, setMemberAccessToken] = useState(
    () => initialMemberAccessToken,
  );
  const [memberAccessPerson, setMemberAccessPerson] = useState<Person | null>(
    null,
  );
  const [memberSchedules, setMemberSchedules] = useState<MemberSchedule[]>([]);
  const [replacementReasonByAssignment, setReplacementReasonByAssignment] =
    useState<Record<string, string>>({});
  const [replacementCandidateByRequest, setReplacementCandidateByRequest] =
    useState<Record<string, string>>({});
  const [memberAccessLinkByPerson, setMemberAccessLinkByPerson] = useState<
    Record<string, string>
  >({});

  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);
  const [isSubmittingPerson, setIsSubmittingPerson] = useState(false);
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const [isSubmittingSeries, setIsSubmittingSeries] = useState(false);
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [updatingSeriesOccurrenceKey, setUpdatingSeriesOccurrenceKey] =
    useState<string | null>(null);
  const [publishingScheduleId, setPublishingScheduleId] = useState<
    string | null
  >(null);
  const [cancellingScheduleId, setCancellingScheduleId] = useState<
    string | null
  >(null);
  const [resendingInvitationAssignmentId, setResendingInvitationAssignmentId] =
    useState<string | null>(null);
  const [isLoadingMemberSchedules, setIsLoadingMemberSchedules] =
    useState(false);
  const [respondingAssignmentId, setRespondingAssignmentId] = useState<
    string | null
  >(null);
  const [
    requestingReplacementAssignmentId,
    setRequestingReplacementAssignmentId,
  ] = useState<string | null>(null);
  const [invitingReplacementRequestId, setInvitingReplacementRequestId] =
    useState<string | null>(null);
  const [completingReplacementRequestId, setCompletingReplacementRequestId] =
    useState<string | null>(null);
  const [creatingMemberAccessPersonId, setCreatingMemberAccessPersonId] =
    useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);

  const activeTenants = useMemo(
    () => tenants.filter((tenant) => tenant.status === "active").length,
    [tenants],
  );
  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.slug === selectedTenantSlug) ?? null,
    [selectedTenantSlug, tenants],
  );
  const assignableSchedules = useMemo(
    () =>
      schedules.filter((schedule) =>
        ["draft", "published"].includes(schedule.status),
      ),
    [schedules],
  );

  async function loadStatus() {
    try {
      const response = await apiFetch(`${apiUrl}/health`, {
        cache: "no-store",
      });
      setApiStatus(response.ok ? "online" : "offline");
    } catch {
      setApiStatus("offline");
    }

    try {
      const response = await apiFetch(`${apiUrl}/health/db`, {
        cache: "no-store",
      });
      setDbStatus(response.ok ? "online" : "offline");
    } catch {
      setDbStatus("offline");
    }
  }

  async function loadSetupStatus() {
    try {
      const response = await apiFetch(`${apiUrl}/auth/setup-status`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Erro ao consultar a configuracao inicial");
      }

      const payload = (await response.json()) as {
        data: { needsSetup: boolean; tenants: SetupTenant[] };
      };
      const firstTenantSlug = payload.data.tenants[0]?.slug ?? "";

      setSetupTenants(payload.data.tenants);
      setSetupTenantSlug((currentSlug) => currentSlug || firstTenantSlug);
      setAuthState(payload.data.needsSetup ? "setup" : "signed_out");
    } catch {
      setAuthMessage("Nao foi possivel abrir o acesso do gestor.");
      setAuthState("signed_out");
    }
  }

  async function loadManagerSession() {
    try {
      const response = await apiFetch(`${apiUrl}/auth/me`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as {
        data: { user: ManagerUser; tenants: Tenant[] };
      };
      setManagerUser(payload.data.user);
      setTenants(payload.data.tenants);
      setAuthState("authenticated");
      return true;
    } catch {
      return false;
    }
  }

  async function loadTenantData(tenantSlug: string) {
    const [
      peopleResponse,
      locationsResponse,
      functionsResponse,
      schedulesResponse,
      seriesResponse,
    ] = await Promise.all([
      apiFetch(`${apiUrl}/tenants/${tenantSlug}/people`, { cache: "no-store" }),
      apiFetch(`${apiUrl}/tenants/${tenantSlug}/locations`, {
        cache: "no-store",
      }),
      apiFetch(`${apiUrl}/tenants/${tenantSlug}/functions`, {
        cache: "no-store",
      }),
      apiFetch(`${apiUrl}/tenants/${tenantSlug}/schedules`, {
        cache: "no-store",
      }),
      apiFetch(`${apiUrl}/tenants/${tenantSlug}/schedule-series`, {
        cache: "no-store",
      }),
    ]);

    if (
      !peopleResponse.ok ||
      !locationsResponse.ok ||
      !functionsResponse.ok ||
      !schedulesResponse.ok ||
      !seriesResponse.ok
    ) {
      throw new Error("Erro ao carregar dados do espaco");
    }

    const peoplePayload = (await peopleResponse.json()) as { data: Person[] };
    const locationsPayload = (await locationsResponse.json()) as {
      data: Location[];
    };
    const functionsPayload = (await functionsResponse.json()) as {
      data: ScheduleFunction[];
    };
    const schedulesPayload = (await schedulesResponse.json()) as {
      data: ScheduleDraft[];
    };
    const seriesPayload = (await seriesResponse.json()) as {
      data: ScheduleSeriesOverview[];
    };

    setPeople(peoplePayload.data);
    setLocations(locationsPayload.data);
    setScheduleFunctions(functionsPayload.data);
    setSchedules(schedulesPayload.data);
    setScheduleSeries(seriesPayload.data);
  }

  async function loadMemberSchedules(
    tenantSlug: string,
    personId: string,
    accessToken = memberAccessToken,
  ) {
    if (!personId && !accessToken) {
      setMemberSchedules([]);
      return;
    }

    setIsLoadingMemberSchedules(true);
    setMemberMessage(null);

    try {
      const response = accessToken
        ? await apiFetch(
            `${apiUrl}/tenants/${tenantSlug}/member-access/${accessToken}/schedules`,
            { cache: "no-store" },
          )
        : await apiFetch(
            `${apiUrl}/tenants/${tenantSlug}/people/${personId}/member-schedules`,
            { cache: "no-store" },
          );

      if (!response.ok) {
        setMemberSchedules([]);
        setMemberAccessPerson(null);
        setMemberMessage(
          accessToken
            ? "Link de acesso invalido ou expirado."
            : "Nao foi possivel carregar a visao do membro.",
        );
        return;
      }

      if (accessToken) {
        const payload = (await response.json()) as {
          data: MemberAccessPayload;
        };
        setMemberAccessPerson(payload.data.person);
        setMemberPersonId(payload.data.person.id);
        setMemberSchedules(payload.data.schedules);
      } else {
        const payload = (await response.json()) as { data: MemberSchedule[] };
        setMemberAccessPerson(null);
        setMemberSchedules(payload.data);
      }
    } catch {
      setMemberSchedules([]);
      setMemberMessage("API indisponivel ao carregar a visao do membro.");
    } finally {
      setIsLoadingMemberSchedules(false);
    }
  }

  async function refresh() {
    await loadStatus();

    if (memberAccessToken) {
      return;
    }

    const hasManagerSession = await loadManagerSession();
    if (!hasManagerSession) {
      setManagerUser(null);
      setTenants([]);
      await loadSetupStatus();
      return;
    }

    if (selectedTenantSlug) {
      await loadTenantData(selectedTenantSlug);
      if (memberPersonId) {
        await loadMemberSchedules(selectedTenantSlug, memberPersonId, "");
      }
    }
  }

  useEffect(() => {
    if (memberAccessToken) {
      setMemberMessage("Acesso do membro carregado por link.");
      return;
    }

    void refresh();
  }, [memberAccessToken]);

  useEffect(() => {
    const selectedTenantIsAvailable = tenants.some(
      (tenant) => tenant.slug === selectedTenantSlug,
    );

    if (!selectedTenantIsAvailable && tenants.length > 0) {
      setSelectedTenantSlug(tenants[0]?.slug ?? null);
    }
  }, [selectedTenantSlug, tenants]);

  useEffect(() => {
    if (
      selectedTenantSlug &&
      !memberAccessToken &&
      authState === "authenticated"
    ) {
      void loadTenantData(selectedTenantSlug).catch(() => {
        setPeople([]);
        setLocations([]);
        setScheduleFunctions([]);
        setSchedules([]);
        setScheduleSeries([]);
        setMemberSchedules([]);
      });
    }
  }, [authState, memberAccessToken, selectedTenantSlug]);

  useEffect(() => {
    const hasSelectedLocation = locations.some(
      (location) => location.id === scheduleLocationId,
    );
    if (!hasSelectedLocation) {
      setScheduleLocationId(locations[0]?.id ?? "");
    }
  }, [locations, scheduleLocationId]);

  useEffect(() => {
    const hasSelectedFunction = scheduleFunctions.some(
      (scheduleFunction) => scheduleFunction.id === scheduleFunctionId,
    );
    if (!hasSelectedFunction) {
      setScheduleFunctionId(scheduleFunctions[0]?.id ?? "");
    }
  }, [scheduleFunctions, scheduleFunctionId]);

  useEffect(() => {
    const hasSelectedSchedule = assignableSchedules.some(
      (schedule) => schedule.id === assignmentScheduleId,
    );
    if (!hasSelectedSchedule) {
      setAssignmentScheduleId(assignableSchedules[0]?.id ?? "");
    }
  }, [assignableSchedules, assignmentScheduleId]);

  useEffect(() => {
    const hasSelectedPerson = people.some(
      (person) => person.id === assignmentPersonId,
    );
    if (!hasSelectedPerson) {
      setAssignmentPersonId(people[0]?.id ?? "");
    }
  }, [assignmentPersonId, people]);

  useEffect(() => {
    if (memberAccessToken) {
      return;
    }

    const hasSelectedMember = people.some(
      (person) => person.id === memberPersonId,
    );
    if (!hasSelectedMember) {
      setMemberPersonId(people[0]?.id ?? "");
    }
  }, [memberAccessToken, memberPersonId, people]);

  useEffect(() => {
    if (selectedTenantSlug && (memberAccessToken || memberPersonId)) {
      void loadMemberSchedules(
        selectedTenantSlug,
        memberPersonId,
        memberAccessToken,
      );
    } else {
      setMemberSchedules([]);
    }
  }, [memberAccessToken, memberPersonId, selectedTenantSlug]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingAuth(true);
    setAuthMessage(null);

    try {
      const response = await apiFetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      if (!response.ok) {
        setAuthMessage("E-mail ou senha nao conferem.");
        return;
      }

      setLoginPassword("");
      await refresh();
    } catch {
      setAuthMessage(
        "Nao foi possivel entrar. Confira se a API esta disponivel.",
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function submitInitialSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingAuth(true);
    setAuthMessage(null);

    try {
      const response = await apiFetch(`${apiUrl}/auth/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: setupName,
          email: setupEmail,
          password: setupPassword,
          tenantSlug: setupTenantSlug,
          ...(setupTenants.length === 0
            ? { tenantDisplayName: setupTenantName }
            : {}),
        }),
      });

      if (response.status === 409) {
        setAuthMessage(
          "Esse primeiro acesso ja foi configurado. Entre com suas credenciais.",
        );
        setAuthState("signed_out");
        return;
      }

      if (!response.ok) {
        setAuthMessage("Nao foi possivel configurar o primeiro acesso.");
        return;
      }

      setSetupPassword("");
      await refresh();
    } catch {
      setAuthMessage(
        "Nao foi possivel configurar o acesso. Confira se a API esta disponivel.",
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function logout() {
    try {
      await apiFetch(`${apiUrl}/auth/logout`, { method: "POST" });
    } finally {
      setManagerUser(null);
      setTenants([]);
      setPeople([]);
      setLocations([]);
      setScheduleFunctions([]);
      setSchedules([]);
      setScheduleSeries([]);
      setMemberSchedules([]);
      setSelectedTenantSlug(null);
      setAuthMessage(null);
      await loadSetupStatus();
    }
  }

  function onNameChange(value: string) {
    setDisplayName(value);
    setSlug(slugify(value));
  }

  function resetScheduleForm() {
    const scheduleWindow = getDefaultScheduleWindow();
    setScheduleTitle("Abertura");
    setScheduleStartsAt(scheduleWindow.startsAt);
    setScheduleEndsAt(scheduleWindow.endsAt);
    setScheduleRequiredCount(1);
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingTenant(true);
    setMessage(null);

    try {
      const response = await apiFetch(`${apiUrl}/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          slug,
        }),
      });

      if (response.status === 409) {
        setMessage("Esse slug ja existe. Escolha outro nome para o espaco.");
        return;
      }

      if (!response.ok) {
        setMessage("Nao foi possivel criar o espaco. Confira os dados.");
        return;
      }

      const payload = (await response.json()) as { data: Tenant };
      setSelectedTenantSlug(payload.data.slug);
      setMessage("Espaco criado com sucesso.");
      setDisplayName("");
      setSlug("");
      await refresh();
    } catch {
      setMessage("API indisponivel. Confira se o pnpm dev esta rodando.");
    } finally {
      setIsSubmittingTenant(false);
    }
  }

  async function createPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantSlug) {
      return;
    }

    setIsSubmittingPerson(true);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/people`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName: personName,
            email: personEmail,
            phone: personPhone,
          }),
        },
      );

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel cadastrar a pessoa.");
        return;
      }

      setPersonName("");
      setPersonEmail("");
      setPersonPhone("");
      setWorkspaceMessage("Pessoa cadastrada.");
      await loadTenantData(selectedTenantSlug);
    } catch {
      setWorkspaceMessage("API indisponivel ao cadastrar pessoa.");
    } finally {
      setIsSubmittingPerson(false);
    }
  }

  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantSlug) {
      return;
    }

    setIsSubmittingLocation(true);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/locations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: locationName,
            address: locationAddress,
          }),
        },
      );

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel cadastrar o local.");
        return;
      }

      setLocationName("");
      setLocationAddress("");
      setWorkspaceMessage("Local cadastrado.");
      await loadTenantData(selectedTenantSlug);
    } catch {
      setWorkspaceMessage("API indisponivel ao cadastrar local.");
    } finally {
      setIsSubmittingLocation(false);
    }
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantSlug) {
      return;
    }

    const locationId = scheduleLocationId || locations[0]?.id;
    const functionId = scheduleFunctionId || scheduleFunctions[0]?.id;

    if (!locationId || !functionId) {
      setWorkspaceMessage(
        "Cadastre pelo menos um local e confirme se a funcao Abertura existe.",
      );
      return;
    }

    const startsAt = new Date(scheduleStartsAt);
    const endsAt = new Date(scheduleEndsAt);

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      startsAt >= endsAt
    ) {
      setWorkspaceMessage(
        "Confira o horario: o fim precisa ser depois do inicio.",
      );
      return;
    }

    setIsSubmittingSchedule(true);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/schedules`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: scheduleTitle,
            locationId,
            functionId,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            requiredCount: scheduleRequiredCount,
          }),
        },
      );

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel criar a escala.");
        return;
      }

      resetScheduleForm();
      setWorkspaceMessage("Escala em rascunho criada.");
      await loadTenantData(selectedTenantSlug);
    } catch {
      setWorkspaceMessage("API indisponivel ao criar escala.");
    } finally {
      setIsSubmittingSchedule(false);
    }
  }

  async function createScheduleSeries(payload: ScheduleSeriesCreatePayload) {
    if (!selectedTenantSlug) {
      return false;
    }

    setIsSubmittingSeries(true);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/schedule-series`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 409
      ) {
        const errorPayload = (await response.json()) as { message?: string };
        setWorkspaceMessage(
          errorPayload.message ?? "Nao foi possivel criar a serie de escalas.",
        );
        return false;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel criar a serie de escalas.");
        return false;
      }

      const result = (await response.json()) as {
        data: {
          occurrenceCount: number;
          skippedOccurrenceCount: number;
        };
      };
      const { occurrenceCount, skippedOccurrenceCount } = result.data;
      const skippedMessage =
        skippedOccurrenceCount > 0
          ? ` e ${skippedOccurrenceCount} data(s) pulada(s)`
          : "";

      setWorkspaceMessage(
        `Serie criada com ${occurrenceCount} rascunho(s)${skippedMessage}.`,
      );
      await loadTenantData(selectedTenantSlug);
      return true;
    } catch {
      setWorkspaceMessage("API indisponivel ao criar a serie de escalas.");
      return false;
    } finally {
      setIsSubmittingSeries(false);
    }
  }

  async function updateScheduleSeriesOccurrence(
    seriesId: string,
    occurrenceDate: string,
    payload: ScheduleSeriesOccurrenceUpdatePayload,
  ) {
    if (!selectedTenantSlug) {
      return;
    }

    const occurrenceKey = `${seriesId}:${occurrenceDate}`;
    setUpdatingSeriesOccurrenceKey(occurrenceKey);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/schedule-series/${seriesId}/occurrences/${occurrenceDate}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 409
      ) {
        const errorPayload = (await response.json()) as { message?: string };
        setWorkspaceMessage(
          errorPayload.message ?? "Nao foi possivel atualizar essa data.",
        );
        return;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel atualizar essa data.");
        return;
      }

      setWorkspaceMessage(
        payload.skipped
          ? "Data da serie atualizada."
          : "Data restaurada como rascunho.",
      );
      await loadTenantData(selectedTenantSlug);
    } catch {
      setWorkspaceMessage("API indisponivel ao atualizar a serie.");
    } finally {
      setUpdatingSeriesOccurrenceKey(null);
    }
  }

  async function assignPersonToScheduleById(
    scheduleId: string,
    personId: string,
    status: AssignmentInitialStatus,
  ) {
    if (!selectedTenantSlug) {
      return false;
    }

    setIsSubmittingAssignment(true);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/schedules/${scheduleId}/assignments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personId,
            status,
          }),
        },
      );

      if ([400, 404, 409].includes(response.status)) {
        const payload = (await response.json()) as { message?: string };
        setWorkspaceMessage(
          payload.message ??
            "Nao foi possivel escalar essa pessoa nesta escala.",
        );
        return false;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel escalar a pessoa.");
        return false;
      }

      setWorkspaceMessage("Pessoa escalada.");
      await loadTenantData(selectedTenantSlug);
      return true;
    } catch {
      setWorkspaceMessage("API indisponivel ao escalar pessoa.");
      return false;
    } finally {
      setIsSubmittingAssignment(false);
    }
  }

  async function assignPersonToSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const scheduleId = assignmentScheduleId || assignableSchedules[0]?.id;
    const personId = assignmentPersonId || people[0]?.id;

    if (!scheduleId || !personId) {
      setWorkspaceMessage(
        "Crie uma escala e cadastre uma pessoa antes de escalar.",
      );
      return;
    }

    await assignPersonToScheduleById(scheduleId, personId, assignmentStatus);
  }

  async function publishSchedule(scheduleId: string) {
    if (!selectedTenantSlug) {
      return;
    }

    setPublishingScheduleId(scheduleId);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/schedules/${scheduleId}/publish`,
        {
          method: "POST",
        },
      );

      if (response.status === 409) {
        const payload = (await response.json()) as { message?: string };
        setWorkspaceMessage(payload.message ?? "Nao foi possivel publicar.");
        return;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel publicar a escala.");
        return;
      }

      const payload = (await response.json()) as {
        data: {
          notifications: NotificationDispatchSummary;
          schedule: ScheduleDraft;
        };
      };
      setWorkspaceMessage(
        `Escala publicada. ${notificationSummaryMessage(
          payload.data.notifications,
        )}`,
      );
      await loadTenantData(selectedTenantSlug);
    } catch {
      setWorkspaceMessage("API indisponivel ao publicar escala.");
    } finally {
      setPublishingScheduleId(null);
    }
  }

  async function cancelSchedule(scheduleId: string, reason: string) {
    if (!selectedTenantSlug) {
      return false;
    }

    setCancellingScheduleId(scheduleId);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/schedules/${scheduleId}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 409
      ) {
        const payload = (await response.json()) as { message?: string };
        setWorkspaceMessage(
          payload.message ?? "Nao foi possivel cancelar a escala.",
        );
        return false;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel cancelar a escala.");
        return false;
      }

      const payload = (await response.json()) as {
        data: {
          cancelledAssignments: number;
          cancelledReplacementRequests: number;
        };
      };
      const assignmentMessage =
        payload.data.cancelledAssignments === 1
          ? "1 atribuicao encerrada"
          : `${payload.data.cancelledAssignments} atribuicoes encerradas`;
      const replacementMessage =
        payload.data.cancelledReplacementRequests > 0
          ? ` e ${payload.data.cancelledReplacementRequests} pedido(s) de substituicao encerrado(s)`
          : "";

      setWorkspaceMessage(
        `Escala cancelada. ${assignmentMessage}${replacementMessage}.`,
      );
      await loadTenantData(selectedTenantSlug);
      return true;
    } catch {
      setWorkspaceMessage("API indisponivel ao cancelar escala.");
      return false;
    } finally {
      setCancellingScheduleId(null);
    }
  }

  async function resendInvitation(scheduleId: string, assignmentId: string) {
    if (!selectedTenantSlug) {
      return;
    }

    setResendingInvitationAssignmentId(assignmentId);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/schedules/${scheduleId}/assignments/${assignmentId}/invitations`,
        {
          method: "POST",
        },
      );

      if (response.status === 409 || response.status === 404) {
        const payload = (await response.json()) as { message?: string };
        setWorkspaceMessage(payload.message ?? "Nao foi possivel reenviar.");
        return;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel reenviar o convite.");
        return;
      }

      const payload = (await response.json()) as {
        data: NotificationDispatchSummary;
      };
      setWorkspaceMessage(
        `Convite reenviado. ${notificationSummaryMessage(payload.data)}`,
      );
      await loadTenantData(selectedTenantSlug);
    } catch {
      setWorkspaceMessage("API indisponivel ao reenviar convite.");
    } finally {
      setResendingInvitationAssignmentId(null);
    }
  }

  function changeMemberPerson(personId: string) {
    setMemberAccessToken("");
    setMemberAccessPerson(null);
    setMemberPersonId(personId);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("memberToken");
      window.history.replaceState(null, "", url.toString());
    }
  }

  function clearMemberAccess() {
    setMemberAccessToken("");
    setMemberAccessPerson(null);
    setMemberMessage(null);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("memberToken");
      window.history.replaceState(null, "", url.toString());
    }
  }

  async function createMemberAccessLink(personId: string) {
    if (!selectedTenantSlug) {
      return;
    }

    setCreatingMemberAccessPersonId(personId);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/people/${personId}/access-links`,
        {
          method: "POST",
        },
      );

      if (response.status === 404) {
        setWorkspaceMessage("Pessoa nao encontrada para gerar acesso.");
        return;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel gerar link de acesso.");
        return;
      }

      const payload = (await response.json()) as { data: MemberAccessLink };
      const link = buildMemberAccessUrl(selectedTenantSlug, payload.data.token);

      setMemberAccessLinkByPerson((currentLinks) => ({
        ...currentLinks,
        [personId]: link,
      }));

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link).catch(() => undefined);
      }

      setWorkspaceMessage(
        `Link de acesso gerado para ${payload.data.person.displayName}.`,
      );
    } catch {
      setWorkspaceMessage("API indisponivel ao gerar link de acesso.");
    } finally {
      setCreatingMemberAccessPersonId(null);
    }
  }

  async function respondToMemberSchedule(
    assignmentId: string,
    status: "confirmed" | "declined",
  ) {
    if (!selectedTenantSlug || (!memberPersonId && !memberAccessToken)) {
      return;
    }

    setRespondingAssignmentId(assignmentId);
    setMemberMessage(null);

    try {
      const response = memberAccessToken
        ? await apiFetch(
            `${apiUrl}/tenants/${selectedTenantSlug}/member-access/${memberAccessToken}/assignments/${assignmentId}/respond`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status }),
            },
          )
        : await apiFetch(
            `${apiUrl}/tenants/${selectedTenantSlug}/people/${memberPersonId}/assignments/${assignmentId}/respond`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status }),
            },
          );

      if (response.status === 401) {
        setMemberMessage("Link de acesso invalido ou expirado.");
        return;
      }

      if (response.status === 409 || response.status === 404) {
        const payload = (await response.json()) as { message?: string };
        setMemberMessage(payload.message ?? "Nao foi possivel responder.");
        return;
      }

      if (!response.ok) {
        setMemberMessage("Nao foi possivel responder essa escala.");
        return;
      }

      if (memberAccessToken) {
        const payload = (await response.json()) as {
          data: MemberAccessPayload;
        };
        setMemberAccessPerson(payload.data.person);
        setMemberSchedules(payload.data.schedules);
      } else {
        const payload = (await response.json()) as { data: MemberSchedule[] };
        setMemberSchedules(payload.data);
      }

      setMemberMessage(
        status === "confirmed" ? "Presenca confirmada." : "Convite recusado.",
      );
      await loadTenantData(selectedTenantSlug);
    } catch {
      setMemberMessage("API indisponivel ao responder escala.");
    } finally {
      setRespondingAssignmentId(null);
    }
  }

  function updateReplacementReason(assignmentId: string, reason: string) {
    setReplacementReasonByAssignment((currentReasons) => ({
      ...currentReasons,
      [assignmentId]: reason,
    }));
  }

  async function requestReplacement(assignmentId: string) {
    if (!selectedTenantSlug || (!memberPersonId && !memberAccessToken)) {
      return;
    }

    setRequestingReplacementAssignmentId(assignmentId);
    setMemberMessage(null);

    try {
      const response = memberAccessToken
        ? await apiFetch(
            `${apiUrl}/tenants/${selectedTenantSlug}/member-access/${memberAccessToken}/assignments/${assignmentId}/replacement-requests`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                reason: replacementReasonByAssignment[assignmentId] ?? "",
              }),
            },
          )
        : await apiFetch(
            `${apiUrl}/tenants/${selectedTenantSlug}/people/${memberPersonId}/assignments/${assignmentId}/replacement-requests`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                reason: replacementReasonByAssignment[assignmentId] ?? "",
              }),
            },
          );

      if (response.status === 401) {
        setMemberMessage("Link de acesso invalido ou expirado.");
        return;
      }

      if (response.status === 409 || response.status === 404) {
        const payload = (await response.json()) as { message?: string };
        setMemberMessage(
          payload.message ?? "Nao foi possivel pedir substituicao.",
        );
        return;
      }

      if (!response.ok) {
        setMemberMessage("Nao foi possivel pedir substituicao.");
        return;
      }

      if (memberAccessToken) {
        const payload = (await response.json()) as {
          data: MemberAccessPayload;
        };
        setMemberAccessPerson(payload.data.person);
        setMemberSchedules(payload.data.schedules);
      } else {
        const payload = (await response.json()) as { data: MemberSchedule[] };
        setMemberSchedules(payload.data);
      }

      setReplacementReasonByAssignment((currentReasons) => ({
        ...currentReasons,
        [assignmentId]: "",
      }));
      setMemberMessage("Pedido de substituicao enviado.");
      await loadTenantData(selectedTenantSlug);
    } catch {
      setMemberMessage("API indisponivel ao pedir substituicao.");
    } finally {
      setRequestingReplacementAssignmentId(null);
    }
  }
  function updateReplacementCandidate(
    replacementRequestId: string,
    personId: string,
  ) {
    setReplacementCandidateByRequest((currentCandidates) => ({
      ...currentCandidates,
      [replacementRequestId]: personId,
    }));
  }

  async function inviteReplacementCandidate(replacementRequestId: string) {
    if (!selectedTenantSlug) {
      return;
    }

    const personId = replacementCandidateByRequest[replacementRequestId];
    if (!personId) {
      setWorkspaceMessage("Escolha uma pessoa disponivel para chamar.");
      return;
    }

    setInvitingReplacementRequestId(replacementRequestId);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/replacement-requests/${replacementRequestId}/candidates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ personId }),
        },
      );

      if (response.status === 409 || response.status === 404) {
        const payload = (await response.json()) as { message?: string };
        setWorkspaceMessage(
          payload.message ?? "Nao foi possivel chamar esse substituto.",
        );
        return;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel chamar esse substituto.");
        return;
      }

      setReplacementCandidateByRequest((currentCandidates) => {
        const nextCandidates = { ...currentCandidates };
        delete nextCandidates[replacementRequestId];
        return nextCandidates;
      });
      setWorkspaceMessage("Substituto convidado.");
      await loadTenantData(selectedTenantSlug);
      if (memberPersonId) {
        await loadMemberSchedules(selectedTenantSlug, memberPersonId);
      }
    } catch {
      setWorkspaceMessage("API indisponivel ao chamar substituto.");
    } finally {
      setInvitingReplacementRequestId(null);
    }
  }

  async function completeReplacementRequest(replacementRequestId: string) {
    if (!selectedTenantSlug) {
      return;
    }

    setCompletingReplacementRequestId(replacementRequestId);
    setWorkspaceMessage(null);

    try {
      const response = await apiFetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/replacement-requests/${replacementRequestId}/complete`,
        {
          method: "POST",
        },
      );

      if (response.status === 409 || response.status === 404) {
        const payload = (await response.json()) as { message?: string };
        setWorkspaceMessage(
          payload.message ?? "Nao foi possivel concluir a substituicao.",
        );
        return;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel concluir a substituicao.");
        return;
      }

      setWorkspaceMessage("Substituicao concluida.");
      await loadTenantData(selectedTenantSlug);
      if (memberPersonId) {
        await loadMemberSchedules(selectedTenantSlug, memberPersonId);
      }
    } catch {
      setWorkspaceMessage("API indisponivel ao concluir substituicao.");
    } finally {
      setCompletingReplacementRequestId(null);
    }
  }

  const isMemberAccessMode = Boolean(memberAccessToken);

  if (isMemberAccessMode) {
    return (
      <main className="shell member-access-shell">
        <section className="member-access-hero">
          <div>
            <p className="eyebrow">Acesso do membro</p>
            <h1>Minhas escalas</h1>
            <p className="hero-copy">
              {memberAccessPerson
                ? `Ola, ${memberAccessPerson.displayName}. Confira suas escalas, responda convites e peca substituicao quando precisar.`
                : "Estamos validando seu link de acesso para carregar suas escalas."}
            </p>
          </div>

          <div className="member-access-summary">
            <span>Espaco</span>
            <strong>
              {selectedTenant?.displayName ??
                selectedTenantSlug ??
                "Carregando"}
            </strong>
          </div>
        </section>

        <MemberPortal
          isLoading={isLoadingMemberSchedules}
          isMemberAccessActive={isMemberAccessMode}
          memberAccessPerson={memberAccessPerson}
          memberMessage={memberMessage}
          memberSchedules={memberSchedules}
          onClearMemberAccess={clearMemberAccess}
          onMemberChange={changeMemberPerson}
          onReplacementReasonChange={updateReplacementReason}
          onRequestReplacement={requestReplacement}
          onRespond={respondToMemberSchedule}
          people={people}
          replacementReasonByAssignment={replacementReasonByAssignment}
          requestingReplacementAssignmentId={requestingReplacementAssignmentId}
          respondingAssignmentId={respondingAssignmentId}
          selectedMemberId={memberPersonId}
        />
      </main>
    );
  }

  if (authState !== "authenticated") {
    return (
      <ManagerAccessPanel
        authMessage={authMessage}
        authState={authState}
        isSubmitting={isSubmittingAuth}
        loginEmail={loginEmail}
        loginPassword={loginPassword}
        onLoginEmailChange={setLoginEmail}
        onLoginPasswordChange={setLoginPassword}
        onLoginSubmit={submitLogin}
        onSetupEmailChange={setSetupEmail}
        onSetupNameChange={setSetupName}
        onSetupPasswordChange={setSetupPassword}
        onSetupSubmit={submitInitialSetup}
        onSetupTenantNameChange={setSetupTenantName}
        onSetupTenantSlugChange={setSetupTenantSlug}
        setupEmail={setupEmail}
        setupName={setupName}
        setupPassword={setupPassword}
        setupTenantName={setupTenantName}
        setupTenantSlug={setupTenantSlug}
        setupTenants={setupTenants}
      />
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SaaS Escala</p>
          <h1>Painel do gestor</h1>
          <p className="hero-copy">
            Organize pessoas, locais e escalas com acesso separado para cada
            espaco.
          </p>
        </div>

        <div className="hero-card">
          <span className="hero-card-label">Gestor conectado</span>
          <strong>{managerUser?.displayName}</strong>
          <p>{managerUser?.email}</p>
          <button className="ghost-button" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </section>

      <section className="stats-grid" aria-label="Resumo do ambiente">
        <StatusCard label="API" status={apiStatus} />
        <StatusCard label="Banco" status={dbStatus} />
        <article className="stat-card">
          <span>Espacos ativos</span>
          <strong>{activeTenants}</strong>
          <small>{tenants.length} espaco(s) no total</small>
        </article>
      </section>

      <section className="content-grid">
        <form className="panel" onSubmit={createTenant}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Onboarding manual</p>
              <h2>Criar espaco</h2>
            </div>
            <button type="button" className="ghost-button" onClick={refresh}>
              Atualizar
            </button>
          </div>

          <label>
            Nome do espaco
            <input
              value={displayName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Piloto Marcelo"
              required
            />
          </label>

          <label>
            Slug
            <input
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              placeholder="piloto-marcelo"
              required
            />
          </label>

          <button className="primary-button" disabled={isSubmittingTenant}>
            {isSubmittingTenant ? "Criando..." : "Criar espaco"}
          </button>

          {message ? <p className="form-message">{message}</p> : null}
        </form>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Tenants</p>
              <h2>Espacos criados</h2>
            </div>
          </div>

          {tenants.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhum espaco ainda.</strong>
              <p>Crie o primeiro espaco para validar o schema por cliente.</p>
            </div>
          ) : (
            <div className="tenant-list">
              {tenants.map((tenant) => (
                <article
                  className={`tenant-card ${
                    tenant.slug === selectedTenantSlug ? "is-selected" : ""
                  }`}
                  key={tenant.id}
                >
                  <div>
                    <strong>{tenant.displayName}</strong>
                    <span>{tenant.slug}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Schema</dt>
                      <dd>{tenant.schemaName}</dd>
                    </div>
                    <div>
                      <dt>Criado</dt>
                      <dd>{formatDate(tenant.createdAt)}</dd>
                    </div>
                  </dl>
                  <button
                    className="select-button"
                    onClick={() => setSelectedTenantSlug(tenant.slug)}
                    type="button"
                  >
                    {tenant.slug === selectedTenantSlug
                      ? "Selecionado"
                      : "Abrir"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Espaco selecionado</p>
            <h2>{selectedTenant?.displayName ?? "Selecione um espaco"}</h2>
            {selectedTenant ? (
              <p>{selectedTenant.slug}</p>
            ) : (
              <p>Crie ou selecione um espaco para cadastrar dados.</p>
            )}
          </div>
          {selectedTenant ? (
            <button
              className="ghost-button"
              onClick={() => refresh()}
              type="button"
            >
              Recarregar dados
            </button>
          ) : null}
        </div>

        {selectedTenant ? (
          <>
            {workspaceMessage ? (
              <p className="workspace-message">{workspaceMessage}</p>
            ) : null}

            <div className="management-grid">
              <form className="panel" onSubmit={createPerson}>
                <p className="eyebrow">Membros</p>
                <h2>Cadastrar pessoa</h2>
                <label>
                  Nome
                  <input
                    value={personName}
                    onChange={(event) => setPersonName(event.target.value)}
                    placeholder="Joao Silva"
                    required
                  />
                </label>
                <label>
                  E-mail opcional
                  <input
                    type="email"
                    value={personEmail}
                    onChange={(event) => setPersonEmail(event.target.value)}
                    placeholder="joao@email.com"
                  />
                </label>
                <label>
                  Telefone opcional
                  <input
                    value={personPhone}
                    onChange={(event) => setPersonPhone(event.target.value)}
                    placeholder="(18) 99999-9999"
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={isSubmittingPerson}
                >
                  {isSubmittingPerson ? "Salvando..." : "Cadastrar pessoa"}
                </button>
              </form>

              <form className="panel" onSubmit={createLocation}>
                <p className="eyebrow">Locais</p>
                <h2>Cadastrar local</h2>
                <label>
                  Nome
                  <input
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                    placeholder="Capela Central"
                    required
                  />
                </label>
                <label>
                  Endereco opcional
                  <input
                    value={locationAddress}
                    onChange={(event) => setLocationAddress(event.target.value)}
                    placeholder="Rua, numero, cidade"
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={isSubmittingLocation}
                >
                  {isSubmittingLocation ? "Salvando..." : "Cadastrar local"}
                </button>
              </form>
            </div>

            <ScheduleSeriesPanel
              functions={scheduleFunctions}
              isSubmitting={isSubmittingSeries}
              locations={locations}
              onCreate={createScheduleSeries}
              people={people}
            />

            <ScheduleSeriesManager
              cancellingScheduleId={cancellingScheduleId}
              isAssigning={isSubmittingAssignment}
              onAssignPerson={assignPersonToScheduleById}
              onCancelSchedule={cancelSchedule}
              onPublishSchedule={publishSchedule}
              onUpdateOccurrence={updateScheduleSeriesOccurrence}
              people={people}
              publishingScheduleId={publishingScheduleId}
              schedules={schedules}
              series={scheduleSeries}
              updatingOccurrenceKey={updatingSeriesOccurrenceKey}
            />

            <div className="management-grid">
              <form className="panel" onSubmit={createSchedule}>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Escalas</p>
                    <h2>Criar rascunho</h2>
                  </div>
                  <span className="count-badge">{schedules.length}</span>
                </div>

                <div className="form-grid">
                  <label className="full-field">
                    Titulo
                    <input
                      value={scheduleTitle}
                      onChange={(event) => setScheduleTitle(event.target.value)}
                      placeholder="Abertura"
                      required
                    />
                  </label>

                  <label>
                    Local
                    <select
                      disabled={locations.length === 0}
                      onChange={(event) =>
                        setScheduleLocationId(event.target.value)
                      }
                      required
                      value={scheduleLocationId}
                    >
                      {locations.length === 0 ? (
                        <option value="">Cadastre um local</option>
                      ) : null}
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Funcao
                    <select
                      disabled={scheduleFunctions.length === 0}
                      onChange={(event) =>
                        setScheduleFunctionId(event.target.value)
                      }
                      required
                      value={scheduleFunctionId}
                    >
                      {scheduleFunctions.length === 0 ? (
                        <option value="">Nenhuma funcao</option>
                      ) : null}
                      {scheduleFunctions.map((scheduleFunction) => (
                        <option
                          key={scheduleFunction.id}
                          value={scheduleFunction.id}
                        >
                          {scheduleFunction.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Inicio
                    <input
                      onChange={(event) =>
                        setScheduleStartsAt(event.target.value)
                      }
                      required
                      type="datetime-local"
                      value={scheduleStartsAt}
                    />
                  </label>

                  <label>
                    Fim
                    <input
                      onChange={(event) =>
                        setScheduleEndsAt(event.target.value)
                      }
                      required
                      type="datetime-local"
                      value={scheduleEndsAt}
                    />
                  </label>

                  <label className="full-field">
                    Vagas
                    <input
                      min={1}
                      max={50}
                      onChange={(event) =>
                        setScheduleRequiredCount(
                          Math.max(1, Number(event.target.value) || 1),
                        )
                      }
                      required
                      type="number"
                      value={scheduleRequiredCount}
                    />
                  </label>
                </div>

                <button
                  className="primary-button"
                  disabled={
                    isSubmittingSchedule ||
                    locations.length === 0 ||
                    scheduleFunctions.length === 0
                  }
                >
                  {isSubmittingSchedule ? "Salvando..." : "Criar rascunho"}
                </button>
              </form>

              <form className="panel" onSubmit={assignPersonToSchedule}>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Alocacao manual</p>
                    <h2>Escalar pessoa</h2>
                  </div>
                  <span className="count-badge">{people.length}</span>
                </div>

                <label>
                  Escala
                  <select
                    disabled={assignableSchedules.length === 0}
                    onChange={(event) =>
                      setAssignmentScheduleId(event.target.value)
                    }
                    required
                    value={assignmentScheduleId}
                  >
                    {assignableSchedules.length === 0 ? (
                      <option value="">Crie uma escala</option>
                    ) : null}
                    {assignableSchedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.title} - {formatDate(schedule.startsAt)} -{" "}
                        {scheduleStatusLabel(schedule.status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Pessoa
                  <select
                    disabled={people.length === 0}
                    onChange={(event) =>
                      setAssignmentPersonId(event.target.value)
                    }
                    required
                    value={assignmentPersonId}
                  >
                    {people.length === 0 ? (
                      <option value="">Cadastre uma pessoa</option>
                    ) : null}
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Status inicial
                  <select
                    onChange={(event) =>
                      setAssignmentStatus(
                        event.target.value as AssignmentInitialStatus,
                      )
                    }
                    value={assignmentStatus}
                  >
                    <option value="externally_confirmed">
                      Confirmado pelo gestor
                    </option>
                    <option value="invited">
                      Convidado / aguardando aceite
                    </option>
                  </select>
                </label>

                <button
                  className="primary-button"
                  disabled={
                    isSubmittingAssignment ||
                    people.length === 0 ||
                    assignableSchedules.length === 0
                  }
                >
                  {isSubmittingAssignment ? "Salvando..." : "Escalar pessoa"}
                </button>
              </form>
            </div>

            <SchedulePanel
              cancellingScheduleId={cancellingScheduleId}
              completingReplacementRequestId={completingReplacementRequestId}
              invitingReplacementRequestId={invitingReplacementRequestId}
              onCompleteReplacementRequest={completeReplacementRequest}
              onCancelSchedule={cancelSchedule}
              onInviteReplacementCandidate={inviteReplacementCandidate}
              onPublishSchedule={publishSchedule}
              onReplacementCandidateChange={updateReplacementCandidate}
              onResendInvitation={resendInvitation}
              people={people}
              publishingScheduleId={publishingScheduleId}
              replacementCandidateByRequest={replacementCandidateByRequest}
              resendingInvitationAssignmentId={resendingInvitationAssignmentId}
              schedules={schedules}
            />

            <MemberPortal
              isLoading={isLoadingMemberSchedules}
              isMemberAccessActive={Boolean(memberAccessToken)}
              memberAccessPerson={memberAccessPerson}
              memberMessage={memberMessage}
              memberSchedules={memberSchedules}
              onClearMemberAccess={clearMemberAccess}
              onMemberChange={changeMemberPerson}
              onReplacementReasonChange={updateReplacementReason}
              onRequestReplacement={requestReplacement}
              onRespond={respondToMemberSchedule}
              people={people}
              replacementReasonByAssignment={replacementReasonByAssignment}
              requestingReplacementAssignmentId={
                requestingReplacementAssignmentId
              }
              respondingAssignmentId={respondingAssignmentId}
              selectedMemberId={memberPersonId}
            />

            <div className="management-grid">
              <MemberAccessPanel
                accessLinkByPerson={memberAccessLinkByPerson}
                creatingMemberAccessPersonId={creatingMemberAccessPersonId}
                onCreateAccessLink={createMemberAccessLink}
                people={people}
              />
              <ListPanel
                emptyText="Nenhum local cadastrado ainda."
                items={locations.map((location) => ({
                  id: location.id,
                  title: location.name,
                  description: location.address || "Sem endereco",
                }))}
                title="Locais"
              />
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function ManagerAccessPanel({
  authMessage,
  authState,
  isSubmitting,
  loginEmail,
  loginPassword,
  onLoginEmailChange,
  onLoginPasswordChange,
  onLoginSubmit,
  onSetupEmailChange,
  onSetupNameChange,
  onSetupPasswordChange,
  onSetupSubmit,
  onSetupTenantNameChange,
  onSetupTenantSlugChange,
  setupEmail,
  setupName,
  setupPassword,
  setupTenantName,
  setupTenantSlug,
  setupTenants,
}: {
  authMessage: string | null;
  authState: AuthState;
  isSubmitting: boolean;
  loginEmail: string;
  loginPassword: string;
  onLoginEmailChange: (value: string) => void;
  onLoginPasswordChange: (value: string) => void;
  onLoginSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSetupEmailChange: (value: string) => void;
  onSetupNameChange: (value: string) => void;
  onSetupPasswordChange: (value: string) => void;
  onSetupSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSetupTenantNameChange: (value: string) => void;
  onSetupTenantSlugChange: (value: string) => void;
  setupEmail: string;
  setupName: string;
  setupPassword: string;
  setupTenantName: string;
  setupTenantSlug: string;
  setupTenants: SetupTenant[];
}) {
  const isSetup = authState === "setup";
  const isLoading = authState === "checking";

  return (
    <main className="manager-access-shell">
      <section className="manager-access-intro">
        <p className="eyebrow">SaaS Escala</p>
        <h1>Escalas em ordem.</h1>
        <p>
          Entre para organizar o trabalho do seu espaco e acompanhar as
          confirmacoes.
        </p>
      </section>

      <section className="manager-access-panel">
        {isLoading ? (
          <div className="manager-access-loading">
            <span className="hero-card-label">Verificando acesso</span>
            <strong>Carregando seu ambiente.</strong>
          </div>
        ) : isSetup ? (
          <form onSubmit={onSetupSubmit}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Primeiro acesso</p>
                <h2>Configurar gestor</h2>
              </div>
            </div>

            <label>
              Seu nome
              <input
                autoComplete="name"
                onChange={(event) => onSetupNameChange(event.target.value)}
                required
                value={setupName}
              />
            </label>

            <label>
              E-mail
              <input
                autoComplete="email"
                onChange={(event) => onSetupEmailChange(event.target.value)}
                required
                type="email"
                value={setupEmail}
              />
            </label>

            <label>
              Senha
              <input
                autoComplete="new-password"
                minLength={12}
                onChange={(event) => onSetupPasswordChange(event.target.value)}
                required
                type="password"
                value={setupPassword}
              />
            </label>

            {setupTenants.length > 0 ? (
              <label>
                Espaco
                <select
                  onChange={(event) =>
                    onSetupTenantSlugChange(event.target.value)
                  }
                  required
                  value={setupTenantSlug}
                >
                  {setupTenants.map((tenant) => (
                    <option key={tenant.slug} value={tenant.slug}>
                      {tenant.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Nome do espaco
                  <input
                    onChange={(event) =>
                      onSetupTenantNameChange(event.target.value)
                    }
                    required
                    value={setupTenantName}
                  />
                </label>
                <label>
                  Identificador do espaco
                  <input
                    onChange={(event) =>
                      onSetupTenantSlugChange(slugify(event.target.value))
                    }
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                    value={setupTenantSlug}
                  />
                </label>
              </>
            )}

            <button className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Configurando..." : "Criar acesso"}
            </button>
          </form>
        ) : (
          <form onSubmit={onLoginSubmit}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Acesso do gestor</p>
                <h2>Entrar</h2>
              </div>
            </div>

            <label>
              E-mail
              <input
                autoComplete="email"
                onChange={(event) => onLoginEmailChange(event.target.value)}
                required
                type="email"
                value={loginEmail}
              />
            </label>

            <label>
              Senha
              <input
                autoComplete="current-password"
                onChange={(event) => onLoginPasswordChange(event.target.value)}
                required
                type="password"
                value={loginPassword}
              />
            </label>

            <button className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        )}

        {authMessage ? <p className="form-message">{authMessage}</p> : null}
      </section>
    </main>
  );
}

function StatusCard({ label, status }: { label: string; status: ApiStatus }) {
  const text =
    status === "checking"
      ? "Checando"
      : status === "online"
        ? "Online"
        : "Offline";

  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong className={`status-${status}`}>{text}</strong>
      <small>
        {status === "offline"
          ? "Confira infraestrutura e API"
          : "Ambiente local"}
      </small>
    </article>
  );
}

function SchedulePanel({
  cancellingScheduleId,
  completingReplacementRequestId,
  invitingReplacementRequestId,
  onCompleteReplacementRequest,
  onCancelSchedule,
  onInviteReplacementCandidate,
  onPublishSchedule,
  onReplacementCandidateChange,
  onResendInvitation,
  people,
  publishingScheduleId,
  replacementCandidateByRequest,
  resendingInvitationAssignmentId,
  schedules,
}: {
  cancellingScheduleId: string | null;
  completingReplacementRequestId: string | null;
  invitingReplacementRequestId: string | null;
  onCompleteReplacementRequest: (replacementRequestId: string) => Promise<void>;
  onCancelSchedule: (scheduleId: string, reason: string) => Promise<boolean>;
  onInviteReplacementCandidate: (replacementRequestId: string) => Promise<void>;
  onPublishSchedule: (scheduleId: string) => Promise<void>;
  onReplacementCandidateChange: (
    replacementRequestId: string,
    personId: string,
  ) => void;
  onResendInvitation: (
    scheduleId: string,
    assignmentId: string,
  ) => Promise<void>;
  people: Person[];
  publishingScheduleId: string | null;
  replacementCandidateByRequest: Record<string, string>;
  resendingInvitationAssignmentId: string | null;
  schedules: ScheduleDraft[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agenda</p>
          <h2>Escalas</h2>
        </div>
        <span className="count-badge">{schedules.length}</span>
      </div>

      {schedules.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhuma escala criada ainda.</strong>
          <p>Crie a primeira escala para liberar o proximo fluxo.</p>
        </div>
      ) : (
        <div className="schedule-list">
          {schedules.map((schedule) => (
            <ScheduleCard
              cancellingScheduleId={cancellingScheduleId}
              completingReplacementRequestId={completingReplacementRequestId}
              invitingReplacementRequestId={invitingReplacementRequestId}
              key={schedule.id}
              onCompleteReplacementRequest={onCompleteReplacementRequest}
              onCancelSchedule={onCancelSchedule}
              onInviteReplacementCandidate={onInviteReplacementCandidate}
              onPublishSchedule={onPublishSchedule}
              onReplacementCandidateChange={onReplacementCandidateChange}
              onResendInvitation={onResendInvitation}
              people={people}
              publishingScheduleId={publishingScheduleId}
              replacementCandidateByRequest={replacementCandidateByRequest}
              resendingInvitationAssignmentId={resendingInvitationAssignmentId}
              schedule={schedule}
              schedules={schedules}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ScheduleCard({
  cancellingScheduleId,
  completingReplacementRequestId,
  invitingReplacementRequestId,
  onCompleteReplacementRequest,
  onCancelSchedule,
  onInviteReplacementCandidate,
  onPublishSchedule,
  onReplacementCandidateChange,
  onResendInvitation,
  people,
  publishingScheduleId,
  replacementCandidateByRequest,
  resendingInvitationAssignmentId,
  schedule,
  schedules,
}: {
  cancellingScheduleId: string | null;
  completingReplacementRequestId: string | null;
  invitingReplacementRequestId: string | null;
  onCompleteReplacementRequest: (replacementRequestId: string) => Promise<void>;
  onCancelSchedule: (scheduleId: string, reason: string) => Promise<boolean>;
  onInviteReplacementCandidate: (replacementRequestId: string) => Promise<void>;
  onPublishSchedule: (scheduleId: string) => Promise<void>;
  onReplacementCandidateChange: (
    replacementRequestId: string,
    personId: string,
  ) => void;
  onResendInvitation: (
    scheduleId: string,
    assignmentId: string,
  ) => Promise<void>;
  people: Person[];
  publishingScheduleId: string | null;
  replacementCandidateByRequest: Record<string, string>;
  resendingInvitationAssignmentId: string | null;
  schedule: ScheduleDraft;
  schedules: ScheduleDraft[];
}) {
  const [isCancellationOpen, setIsCancellationOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const activeAssignmentCount = countEffectiveAssignments(schedule);
  const replacementRequestsById = getReplacementRequestsById(schedule);
  const replacementRequestsInProgress =
    countReplacementRequestsInProgress(schedule);
  const replacementCandidatePeople = getReplacementCandidatePeople(
    people,
    schedules,
    schedule,
  );
  const isCancelling = cancellingScheduleId === schedule.id;

  async function submitCancellation() {
    if (cancellationReason.trim().length < 2) {
      return;
    }

    const cancelled = await onCancelSchedule(
      schedule.id,
      cancellationReason.trim(),
    );
    if (cancelled) {
      setIsCancellationOpen(false);
      setCancellationReason("");
    }
  }

  return (
    <article className="schedule-card">
      <header>
        <div>
          <strong>{schedule.title}</strong>
          <span>{schedule.location.name}</span>
        </div>
        <span className="pill">{scheduleStatusLabel(schedule.status)}</span>
      </header>
      <p>
        {formatDate(schedule.startsAt)} ate {formatDate(schedule.endsAt)}
      </p>
      <div className="schedule-meta">
        <span>{schedule.slot.function.name}</span>
        {schedule.seriesId ? <span>Serie recorrente</span> : null}
        <span>
          {activeAssignmentCount}/{schedule.slot.requiredCount} vaga(s)
        </span>
        {replacementRequestsInProgress > 0 ? (
          <span>
            {replacementRequestsInProgress === 1
              ? "1 substituicao em andamento"
              : `${replacementRequestsInProgress} substituicoes em andamento`}
          </span>
        ) : null}
      </div>

      {schedule.status === "draft" ? (
        <div className="schedule-actions">
          <button
            className="secondary-button"
            disabled={publishingScheduleId === schedule.id}
            onClick={() => void onPublishSchedule(schedule.id)}
            type="button"
          >
            {publishingScheduleId === schedule.id
              ? "Publicando..."
              : "Publicar escala"}
          </button>
          {activeAssignmentCount < schedule.slot.requiredCount ? (
            <span>Esta escala sera publicada com vagas em aberto.</span>
          ) : null}
        </div>
      ) : null}

      {schedule.status === "published" ? (
        <div className="schedule-actions">
          <button
            className="danger-button"
            disabled={isCancelling}
            onClick={() => setIsCancellationOpen((isOpen) => !isOpen)}
            type="button"
          >
            Cancelar escala
          </button>
        </div>
      ) : null}

      {schedule.status === "published" && isCancellationOpen ? (
        <div className="schedule-cancellation-form">
          <label>
            Motivo do cancelamento
            <textarea
              disabled={isCancelling}
              maxLength={500}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Ex.: evento cancelado ou local indisponivel"
              rows={3}
              value={cancellationReason}
            />
          </label>
          <div className="schedule-cancellation-actions">
            <button
              className="danger-button"
              disabled={isCancelling || cancellationReason.trim().length < 2}
              onClick={() => void submitCancellation()}
              type="button"
            >
              {isCancelling ? "Cancelando..." : "Confirmar cancelamento"}
            </button>
            <button
              className="ghost-button"
              disabled={isCancelling}
              onClick={() => setIsCancellationOpen(false)}
              type="button"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : null}

      {schedule.status === "cancelled" ? (
        <div className="series-manager-warning">
          <strong>Escala cancelada.</strong>{" "}
          {schedule.cancelledReason ?? "Sem motivo informado."}
          {schedule.cancelledAt
            ? ` Cancelada em ${formatDate(schedule.cancelledAt)}.`
            : ""}
        </div>
      ) : null}

      {schedule.assignments.length === 0 ? (
        <div className="assignment-empty">Nenhuma pessoa escalada.</div>
      ) : (
        <div className="assignment-list">
          {schedule.assignments.map((assignment) => {
            const replacementRequest = assignment.replacementRequest;
            const linkedReplacementRequest = assignment.replacementRequestId
              ? (replacementRequestsById.get(assignment.replacementRequestId) ??
                null)
              : null;
            const selectedCandidateId = replacementRequest
              ? (replacementCandidateByRequest[replacementRequest.id] ?? "")
              : "";
            const selectedCandidateIsAvailable =
              replacementCandidatePeople.some(
                (person) => person.id === selectedCandidateId,
              );
            const assignmentClassName = [
              "assignment-item",
              replacementRequest ? "is-replacement-original" : "",
              assignment.replacementRequestId ? "is-replacement-candidate" : "",
              assignment.status === "cancelled" ? "is-cancelled" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div className={assignmentClassName} key={assignment.id}>
                <div className="assignment-detail">
                  <div>
                    <div className="assignment-title-row">
                      <strong>{assignment.assigneeName}</strong>
                      {replacementRequest ? (
                        <span
                          className={`assignment-badge ${
                            replacementRequest.status === "completed"
                              ? "is-success"
                              : "is-warning"
                          }`}
                        >
                          {originalReplacementBadgeLabel(replacementRequest)}
                        </span>
                      ) : null}
                      {assignment.replacementRequestId ? (
                        <span
                          className={`assignment-badge ${
                            linkedReplacementRequest?.status === "completed"
                              ? "is-success"
                              : linkedReplacementRequest?.status === "accepted"
                                ? "is-info"
                                : assignment.status === "declined"
                                  ? "is-muted"
                                  : "is-warning"
                          }`}
                        >
                          {replacementCandidateBadgeLabel(
                            assignment,
                            linkedReplacementRequest,
                          )}
                        </span>
                      ) : null}
                    </div>
                    {replacementRequest ? (
                      <small>
                        {replacementRequestStatusLabel(
                          replacementRequest.status,
                        )}
                        {replacementRequest.reason
                          ? `: ${replacementRequest.reason}`
                          : ""}
                      </small>
                    ) : null}
                    {linkedReplacementRequest ? (
                      <small>
                        Ligado ao pedido:{" "}
                        {replacementRequestStatusLabel(
                          linkedReplacementRequest.status,
                        )}
                      </small>
                    ) : null}
                    {schedule.status === "published" &&
                    assignment.status === "invited" ? (
                      <div className="assignment-notification">
                        <small
                          className={
                            assignment.notification?.status === "failed"
                              ? "is-failed"
                              : ""
                          }
                        >
                          {notificationDeliveryLabel(assignment.notification)}
                        </small>
                        <button
                          className="ghost-button"
                          disabled={
                            resendingInvitationAssignmentId === assignment.id
                          }
                          onClick={() =>
                            void onResendInvitation(schedule.id, assignment.id)
                          }
                          type="button"
                        >
                          {resendingInvitationAssignmentId === assignment.id
                            ? "Enviando..."
                            : "Reenviar convite"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {replacementRequest &&
                  canInviteReplacementCandidate(replacementRequest.status) ? (
                    <div className="replacement-manager-actions">
                      <label>
                        Chamar substituto
                        <select
                          disabled={
                            replacementCandidatePeople.length === 0 ||
                            invitingReplacementRequestId ===
                              replacementRequest.id
                          }
                          onChange={(event) =>
                            onReplacementCandidateChange(
                              replacementRequest.id,
                              event.target.value,
                            )
                          }
                          value={
                            selectedCandidateIsAvailable
                              ? selectedCandidateId
                              : ""
                          }
                        >
                          <option value="">
                            Selecione uma pessoa disponivel
                          </option>
                          {replacementCandidatePeople.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="secondary-button"
                        disabled={
                          !selectedCandidateIsAvailable ||
                          invitingReplacementRequestId === replacementRequest.id
                        }
                        onClick={() =>
                          void onInviteReplacementCandidate(
                            replacementRequest.id,
                          )
                        }
                        type="button"
                      >
                        {invitingReplacementRequestId === replacementRequest.id
                          ? "Chamando..."
                          : "Chamar"}
                      </button>
                      {replacementCandidatePeople.length === 0 ? (
                        <p>Nenhuma pessoa disponivel nesse horario.</p>
                      ) : null}
                    </div>
                  ) : null}

                  {replacementRequest &&
                  replacementRequest.status === "accepted" ? (
                    <div className="replacement-manager-actions">
                      <p>
                        O substituto aceitou. Conclua a troca para remover a
                        pessoa original da escala.
                      </p>
                      <button
                        className="secondary-button"
                        disabled={
                          completingReplacementRequestId ===
                          replacementRequest.id
                        }
                        onClick={() =>
                          void onCompleteReplacementRequest(
                            replacementRequest.id,
                          )
                        }
                        type="button"
                      >
                        {completingReplacementRequestId ===
                        replacementRequest.id
                          ? "Concluindo..."
                          : "Concluir troca"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <span className="assignment-status">
                  {assignmentStatusLabel(assignment.status)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function MemberPortal({
  isLoading,
  isMemberAccessActive,
  memberAccessPerson,
  memberMessage,
  memberSchedules,
  onClearMemberAccess,
  onMemberChange,
  onReplacementReasonChange,
  onRequestReplacement,
  onRespond,
  people,
  replacementReasonByAssignment,
  requestingReplacementAssignmentId,
  respondingAssignmentId,
  selectedMemberId,
}: {
  isLoading: boolean;
  isMemberAccessActive: boolean;
  memberAccessPerson: Person | null;
  memberMessage: string | null;
  memberSchedules: MemberSchedule[];
  onClearMemberAccess: () => void;
  onMemberChange: (personId: string) => void;
  onReplacementReasonChange: (assignmentId: string, reason: string) => void;
  onRequestReplacement: (assignmentId: string) => Promise<void>;
  onRespond: (
    assignmentId: string,
    status: "confirmed" | "declined",
  ) => Promise<void>;
  people: Person[];
  replacementReasonByAssignment: Record<string, string>;
  requestingReplacementAssignmentId: string | null;
  respondingAssignmentId: string | null;
  selectedMemberId: string;
}) {
  const memberSummary = useMemo(() => {
    const invitations = memberSchedules.filter((memberSchedule) =>
      ["invited", "pending"].includes(memberSchedule.assignment.status),
    ).length;
    const confirmed = memberSchedules.filter((memberSchedule) =>
      ["confirmed", "externally_confirmed"].includes(
        memberSchedule.assignment.status,
      ),
    ).length;
    const replacements = memberSchedules.filter(
      (memberSchedule) => memberSchedule.assignment.replacementRequest,
    ).length;
    const cancellations = memberSchedules.filter(
      (memberSchedule) =>
        memberSchedule.schedule.status === "cancelled" ||
        memberSchedule.assignment.status === "cancelled",
    ).length;

    return {
      cancellations,
      confirmed,
      invitations,
      replacements,
      total: memberSchedules.length,
    };
  }, [memberSchedules]);

  return (
    <section className="panel member-portal">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Portal do membro</p>
          <h2>Minhas escalas</h2>
        </div>
        <span className="count-badge">{memberSchedules.length}</span>
      </div>

      {isMemberAccessActive ? (
        <div className="member-access-banner">
          <div>
            <strong>
              {memberAccessPerson?.displayName ?? "Validando acesso..."}
            </strong>
            <span>Acesso do membro por link</span>
          </div>
          <button
            className="ghost-button"
            onClick={onClearMemberAccess}
            type="button"
          >
            Sair do acesso
          </button>
        </div>
      ) : (
        <div className="member-toolbar">
          <label>
            Ver como
            <select
              disabled={people.length === 0}
              onChange={(event) => onMemberChange(event.target.value)}
              value={selectedMemberId}
            >
              {people.length === 0 ? (
                <option value="">Cadastre uma pessoa</option>
              ) : null}
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {memberMessage ? <p className="member-message">{memberMessage}</p> : null}

      {!isLoading && memberSchedules.length > 0 ? (
        <div className="member-portal-summary">
          <div>
            <span>Total</span>
            <strong>{memberSummary.total}</strong>
          </div>
          <div>
            <span>Convites</span>
            <strong>{memberSummary.invitations}</strong>
          </div>
          <div>
            <span>Confirmadas</span>
            <strong>{memberSummary.confirmed}</strong>
          </div>
          <div>
            <span>Substituicoes</span>
            <strong>{memberSummary.replacements}</strong>
          </div>
          <div>
            <span>Canceladas</span>
            <strong>{memberSummary.cancellations}</strong>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="empty-state member-empty-state">
          <strong>Carregando escalas do membro...</strong>
        </div>
      ) : memberSchedules.length === 0 ? (
        <div className="empty-state member-empty-state">
          <strong>Nenhuma escala publicada para essa pessoa.</strong>
          <p>
            {isMemberAccessActive
              ? "Quando houver uma escala publicada, ela aparecera aqui."
              : "Publique uma escala com essa pessoa para aparecer nesta visao."}
          </p>
        </div>
      ) : (
        <div className="member-schedule-list">
          {memberSchedules.map((memberSchedule) => {
            const isScheduleCancelled =
              memberSchedule.schedule.status === "cancelled" ||
              memberSchedule.assignment.status === "cancelled";
            const canRespond =
              !isScheduleCancelled &&
              ["invited", "pending"].includes(memberSchedule.assignment.status);
            const replacementRequest =
              memberSchedule.assignment.replacementRequest;
            const canRequestReplacement =
              !isScheduleCancelled &&
              memberSchedule.schedule.status === "published" &&
              ["confirmed", "externally_confirmed"].includes(
                memberSchedule.assignment.status,
              ) &&
              !replacementRequest;

            return (
              <article
                className={`member-schedule-card ${
                  isScheduleCancelled ? "is-cancelled" : ""
                }`}
                key={memberSchedule.assignment.id}
              >
                <header className="member-schedule-card-header">
                  <div className="member-schedule-title">
                    <span>{memberSchedule.schedule.slot.function.name}</span>
                    <strong>{memberSchedule.schedule.title}</strong>
                  </div>
                  <span
                    className={memberAssignmentPillClassName(
                      isScheduleCancelled
                        ? "cancelled"
                        : memberSchedule.assignment.status,
                    )}
                  >
                    {isScheduleCancelled
                      ? "Escala cancelada"
                      : assignmentStatusLabel(memberSchedule.assignment.status)}
                  </span>
                </header>

                <div className="member-schedule-detail-grid">
                  <div>
                    <span>Data</span>
                    <strong>
                      {formatScheduleDay(memberSchedule.schedule.startsAt)}
                    </strong>
                  </div>
                  <div>
                    <span>Horario</span>
                    <strong>
                      {formatTimeRange(
                        memberSchedule.schedule.startsAt,
                        memberSchedule.schedule.endsAt,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Local</span>
                    <strong>{memberSchedule.schedule.location.name}</strong>
                  </div>
                  <div>
                    <span>Escala</span>
                    <strong>
                      {scheduleStatusLabel(memberSchedule.schedule.status)}
                    </strong>
                  </div>
                </div>

                {isScheduleCancelled ? (
                  <div className="member-cancelled-box">
                    <strong>Esta escala foi cancelada.</strong>
                    <span>
                      {memberSchedule.schedule.cancelledReason ??
                        "O gestor cancelou esta data."}
                    </span>
                    {memberSchedule.schedule.cancelledAt ? (
                      <small>
                        Cancelada em{" "}
                        {formatDate(memberSchedule.schedule.cancelledAt)}
                      </small>
                    ) : null}
                  </div>
                ) : null}

                {memberSchedule.companions.length === 0 ? (
                  <div className="assignment-empty">
                    {isScheduleCancelled
                      ? "Nenhuma outra pessoa estava nesta escala."
                      : "Nenhuma outra pessoa escalada no mesmo horario."}
                  </div>
                ) : (
                  <div className="companion-list">
                    <span>
                      {isScheduleCancelled ? "Tambem estava" : "Junto com"}
                    </span>
                    <div>
                      {memberSchedule.companions.map((companion) => (
                        <strong key={companion.id}>
                          {companion.assigneeName}
                        </strong>
                      ))}
                    </div>
                  </div>
                )}

                {replacementRequest && !isScheduleCancelled ? (
                  <div className="replacement-request-box">
                    <strong>
                      {replacementRequestStatusLabel(replacementRequest.status)}
                    </strong>
                    {replacementRequest.reason ? (
                      <span>{replacementRequest.reason}</span>
                    ) : (
                      <span>Sem motivo informado.</span>
                    )}
                  </div>
                ) : null}

                {canRespond ? (
                  <div className="member-action-box is-invite">
                    <div className="member-action-copy">
                      <strong>Voce foi convidado para esta escala.</strong>
                      <span>Confirme sua presenca ou recuse o convite.</span>
                    </div>
                    <div className="inline-actions member-inline-actions">
                      <button
                        className="secondary-button"
                        disabled={
                          respondingAssignmentId ===
                          memberSchedule.assignment.id
                        }
                        onClick={() =>
                          void onRespond(
                            memberSchedule.assignment.id,
                            "confirmed",
                          )
                        }
                        type="button"
                      >
                        Confirmar
                      </button>
                      <button
                        className="danger-button"
                        disabled={
                          respondingAssignmentId ===
                          memberSchedule.assignment.id
                        }
                        onClick={() =>
                          void onRespond(
                            memberSchedule.assignment.id,
                            "declined",
                          )
                        }
                        type="button"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ) : null}

                {canRequestReplacement ? (
                  <div className="member-action-box replacement-request-form">
                    <div className="member-action-copy">
                      <strong>Precisa pedir substituicao?</strong>
                      <span>
                        O gestor acompanha o pedido e chama uma pessoa
                        disponivel.
                      </span>
                    </div>
                    <label>
                      Motivo opcional
                      <textarea
                        onChange={(event) =>
                          onReplacementReasonChange(
                            memberSchedule.assignment.id,
                            event.target.value,
                          )
                        }
                        placeholder="Ex.: surgiu um imprevisto nesse horario"
                        rows={3}
                        value={
                          replacementReasonByAssignment[
                            memberSchedule.assignment.id
                          ] ?? ""
                        }
                      />
                    </label>
                    <button
                      className="secondary-button"
                      disabled={
                        requestingReplacementAssignmentId ===
                        memberSchedule.assignment.id
                      }
                      onClick={() =>
                        void onRequestReplacement(memberSchedule.assignment.id)
                      }
                      type="button"
                    >
                      {requestingReplacementAssignmentId ===
                      memberSchedule.assignment.id
                        ? "Enviando..."
                        : "Pedir substituicao"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MemberAccessPanel({
  accessLinkByPerson,
  creatingMemberAccessPersonId,
  onCreateAccessLink,
  people,
}: {
  accessLinkByPerson: Record<string, string>;
  creatingMemberAccessPersonId: string | null;
  onCreateAccessLink: (personId: string) => Promise<void>;
  people: Person[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Acesso simples</p>
          <h2>Links dos membros</h2>
        </div>
        <span className="count-badge">{people.length}</span>
      </div>

      {people.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhuma pessoa cadastrada ainda.</strong>
        </div>
      ) : (
        <div className="member-access-list">
          {people.map((person) => {
            const accessLink = accessLinkByPerson[person.id];

            return (
              <article className="member-access-card" key={person.id}>
                <div>
                  <strong>{person.displayName}</strong>
                  <span>{person.email || person.phone || "Sem contato"}</span>
                </div>
                <button
                  className="secondary-button"
                  disabled={creatingMemberAccessPersonId === person.id}
                  onClick={() => void onCreateAccessLink(person.id)}
                  type="button"
                >
                  {creatingMemberAccessPersonId === person.id
                    ? "Gerando..."
                    : "Gerar link"}
                </button>
                {accessLink ? (
                  <label className="access-link-field">
                    Link gerado
                    <textarea readOnly rows={2} value={accessLink} />
                  </label>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ListPanel({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: Array<{ id: string; title: string; description: string }>;
  title: string;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h2>{title}</h2>
        </div>
        <span className="count-badge">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <strong>{emptyText}</strong>
        </div>
      ) : (
        <div className="simple-list">
          {items.map((item) => (
            <article className="simple-list-item" key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
