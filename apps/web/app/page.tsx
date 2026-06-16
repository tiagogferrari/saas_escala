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

type ApiStatus = "checking" | "online" | "offline";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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

export default function HomePage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [dbStatus, setDbStatus] = useState<ApiStatus>("checking");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState<string | null>(
    null,
  );
  const [people, setPeople] = useState<Person[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [displayName, setDisplayName] = useState("Piloto Marcelo");
  const [slug, setSlug] = useState("piloto-marcelo");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");

  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);
  const [isSubmittingPerson, setIsSubmittingPerson] = useState(false);
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);
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
    const [peopleResponse, locationsResponse] = await Promise.all([
      fetch(`${apiUrl}/tenants/${tenantSlug}/people`, { cache: "no-store" }),
      fetch(`${apiUrl}/tenants/${tenantSlug}/locations`, { cache: "no-store" }),
    ]);

    if (!peopleResponse.ok || !locationsResponse.ok) {
      throw new Error("Erro ao carregar dados do espaco");
    }

    const peoplePayload = (await peopleResponse.json()) as { data: Person[] };
    const locationsPayload = (await locationsResponse.json()) as {
      data: Location[];
    };

    setPeople(peoplePayload.data);
    setLocations(locationsPayload.data);
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
      });
    }
  }, [selectedTenantSlug]);

  function onNameChange(value: string) {
    setDisplayName(value);
    setSlug(slugify(value));
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

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SaaS Escala</p>
          <h1>Gestao inteligente de escalas e voluntariado</h1>
          <p className="hero-copy">
            Painel inicial para validar espacos, pessoas e locais antes da
            primeira escala.
          </p>
        </div>

        <div className="hero-card">
          <span className="hero-card-label">Fluxo atual</span>
          <strong>Criar espaco, cadastrar pessoas e cadastrar locais.</strong>
          <p>
            Depois disso, o proximo passo sera montar a primeira escala em
            rascunho.
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
            <button className="ghost-button" onClick={() => refresh()}>
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
