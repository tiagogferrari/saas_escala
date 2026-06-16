"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

type ScheduleAssignment = {
  id: string;
  scheduleSlotId: string;
  assigneeType: "person" | "group";
  assigneeId: string;
  assigneeName: string;
  status: string;
  confirmedAt: string | null;
  confirmationSource: string | null;
  createdAt: string;
};

type ScheduleDraft = {
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
  assignments: ScheduleAssignment[];
  createdAt: string;
};

type ApiStatus = "checking" | "online" | "offline";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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

export default function HomePage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [dbStatus, setDbStatus] = useState<ApiStatus>("checking");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState<string | null>(
    null,
  );
  const [people, setPeople] = useState<Person[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [scheduleFunctions, setScheduleFunctions] = useState<
    ScheduleFunction[]
  >([]);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);

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
  const [assignmentStatus, setAssignmentStatus] = useState<
    "externally_confirmed" | "invited"
  >("externally_confirmed");

  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);
  const [isSubmittingPerson, setIsSubmittingPerson] = useState(false);
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);

  const activeTenants = useMemo(
    () => tenants.filter((tenant) => tenant.status === "active").length,
    [tenants],
  );
  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.slug === selectedTenantSlug) ?? null,
    [selectedTenantSlug, tenants],
  );

  async function loadStatus() {
    try {
      const response = await fetch(`${apiUrl}/health`, { cache: "no-store" });
      setApiStatus(response.ok ? "online" : "offline");
    } catch {
      setApiStatus("offline");
    }

    try {
      const response = await fetch(`${apiUrl}/health/db`, { cache: "no-store" });
      setDbStatus(response.ok ? "online" : "offline");
    } catch {
      setDbStatus("offline");
    }
  }

  async function loadTenants() {
    try {
      const response = await fetch(`${apiUrl}/tenants`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Erro ao listar espacos");
      }

      const payload = (await response.json()) as { data: Tenant[] };
      setTenants(payload.data);
    } catch {
      setTenants([]);
    }
  }

  async function loadTenantData(tenantSlug: string) {
    const [
      peopleResponse,
      locationsResponse,
      functionsResponse,
      schedulesResponse,
    ] = await Promise.all([
      fetch(`${apiUrl}/tenants/${tenantSlug}/people`, { cache: "no-store" }),
      fetch(`${apiUrl}/tenants/${tenantSlug}/locations`, { cache: "no-store" }),
      fetch(`${apiUrl}/tenants/${tenantSlug}/functions`, { cache: "no-store" }),
      fetch(`${apiUrl}/tenants/${tenantSlug}/schedules`, { cache: "no-store" }),
    ]);

    if (
      !peopleResponse.ok ||
      !locationsResponse.ok ||
      !functionsResponse.ok ||
      !schedulesResponse.ok
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

    setPeople(peoplePayload.data);
    setLocations(locationsPayload.data);
    setScheduleFunctions(functionsPayload.data);
    setSchedules(schedulesPayload.data);
  }

  async function refresh() {
    await Promise.all([loadStatus(), loadTenants()]);
    if (selectedTenantSlug) {
      await loadTenantData(selectedTenantSlug);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedTenantSlug && tenants.length > 0) {
      setSelectedTenantSlug(tenants[0]?.slug ?? null);
    }
  }, [selectedTenantSlug, tenants]);

  useEffect(() => {
    if (selectedTenantSlug) {
      void loadTenantData(selectedTenantSlug).catch(() => {
        setPeople([]);
        setLocations([]);
        setScheduleFunctions([]);
        setSchedules([]);
      });
    }
  }, [selectedTenantSlug]);

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
    const hasSelectedSchedule = schedules.some(
      (schedule) => schedule.id === assignmentScheduleId,
    );
    if (!hasSelectedSchedule) {
      setAssignmentScheduleId(schedules[0]?.id ?? "");
    }
  }, [assignmentScheduleId, schedules]);

  useEffect(() => {
    const hasSelectedPerson = people.some(
      (person) => person.id === assignmentPersonId,
    );
    if (!hasSelectedPerson) {
      setAssignmentPersonId(people[0]?.id ?? "");
    }
  }, [assignmentPersonId, people]);

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
      const response = await fetch(`${apiUrl}/tenants`, {
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
      const response = await fetch(
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
      const response = await fetch(
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
      setWorkspaceMessage("Confira o horario: o fim precisa ser depois do inicio.");
      return;
    }

    setIsSubmittingSchedule(true);
    setWorkspaceMessage(null);

    try {
      const response = await fetch(
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

  async function assignPersonToSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantSlug) {
      return;
    }

    const scheduleId = assignmentScheduleId || schedules[0]?.id;
    const personId = assignmentPersonId || people[0]?.id;

    if (!scheduleId || !personId) {
      setWorkspaceMessage("Crie uma escala e cadastre uma pessoa antes de escalar.");
      return;
    }

    setIsSubmittingAssignment(true);
    setWorkspaceMessage(null);

    try {
      const response = await fetch(
        `${apiUrl}/tenants/${selectedTenantSlug}/schedules/${scheduleId}/assignments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personId,
            status: assignmentStatus,
          }),
        },
      );

      if (response.status === 409) {
        const payload = (await response.json()) as { message?: string };
        setWorkspaceMessage(
          payload.message ??
            "Nao foi possivel escalar essa pessoa nesta escala.",
        );
        return;
      }

      if (!response.ok) {
        setWorkspaceMessage("Nao foi possivel escalar a pessoa.");
        return;
      }

      setWorkspaceMessage("Pessoa escalada.");
      await loadTenantData(selectedTenantSlug);
    } catch {
      setWorkspaceMessage("API indisponivel ao escalar pessoa.");
    } finally {
      setIsSubmittingAssignment(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SaaS Escala</p>
          <h1>Gestao inteligente de escalas e voluntariado</h1>
          <p className="hero-copy">
            Painel inicial para validar espacos, pessoas, locais e as primeiras
            escalas em rascunho.
          </p>
        </div>

        <div className="hero-card">
          <span className="hero-card-label">Fluxo atual</span>
          <strong>Criar espaco, cadastrar base e montar rascunho.</strong>
          <p>
            A confirmacao e os convites entram no proximo passo, em cima de uma
            escala real.
          </p>
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
                    {tenant.slug === selectedTenantSlug ? "Selecionado" : "Abrir"}
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
                <button className="primary-button" disabled={isSubmittingPerson}>
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
                      onChange={(event) => setScheduleEndsAt(event.target.value)}
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
                    disabled={schedules.length === 0}
                    onChange={(event) =>
                      setAssignmentScheduleId(event.target.value)
                    }
                    required
                    value={assignmentScheduleId}
                  >
                    {schedules.length === 0 ? (
                      <option value="">Crie uma escala</option>
                    ) : null}
                    {schedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.title} - {formatDate(schedule.startsAt)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Pessoa
                  <select
                    disabled={people.length === 0}
                    onChange={(event) => setAssignmentPersonId(event.target.value)}
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
                        event.target.value as "externally_confirmed" | "invited",
                      )
                    }
                    value={assignmentStatus}
                  >
                    <option value="externally_confirmed">
                      Confirmado pelo gestor
                    </option>
                    <option value="invited">Convidado / aguardando aceite</option>
                  </select>
                </label>

                <button
                  className="primary-button"
                  disabled={
                    isSubmittingAssignment ||
                    people.length === 0 ||
                    schedules.length === 0
                  }
                >
                  {isSubmittingAssignment ? "Salvando..." : "Escalar pessoa"}
                </button>
              </form>
            </div>

            <SchedulePanel schedules={schedules} />

            <div className="management-grid">
              <ListPanel
                emptyText="Nenhuma pessoa cadastrada ainda."
                items={people.map((person) => ({
                  id: person.id,
                  title: person.displayName,
                  description: person.email || person.phone || "Sem contato",
                }))}
                title="Pessoas"
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

function SchedulePanel({ schedules }: { schedules: ScheduleDraft[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agenda</p>
          <h2>Rascunhos</h2>
        </div>
        <span className="count-badge">{schedules.length}</span>
      </div>

      {schedules.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhuma escala em rascunho ainda.</strong>
          <p>Crie a primeira escala para liberar o proximo fluxo.</p>
        </div>
      ) : (
        <div className="schedule-list">
          {schedules.map((schedule) => (
            <article className="schedule-card" key={schedule.id}>
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
                <span>
                  {schedule.assignments.length}/{schedule.slot.requiredCount}{" "}
                  vaga(s)
                </span>
              </div>

              {schedule.assignments.length === 0 ? (
                <div className="assignment-empty">Nenhuma pessoa escalada.</div>
              ) : (
                <div className="assignment-list">
                  {schedule.assignments.map((assignment) => (
                    <div className="assignment-item" key={assignment.id}>
                      <strong>{assignment.assigneeName}</strong>
                      <span>{assignmentStatusLabel(assignment.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
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
