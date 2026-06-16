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
  const [displayName, setDisplayName] = useState("Piloto Marcelo");
  const [slug, setSlug] = useState("piloto-marcelo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeTenants = useMemo(
    () => tenants.filter((tenant) => tenant.status === "active").length,
    [tenants],
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

  async function refresh() {
    await Promise.all([loadStatus(), loadTenants()]);
  }

  useEffect(() => {
    void refresh();
  }, []);

  function onNameChange(value: string) {
    setDisplayName(value);
    setSlug(slugify(value));
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
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

      setMessage("Espaco criado com sucesso.");
      setDisplayName("");
      setSlug("");
      await refresh();
    } catch {
      setMessage("API indisponivel. Confira se o pnpm dev esta rodando.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SaaS Escala</p>
          <h1>Gestao inteligente de escalas e voluntariado</h1>
          <p className="hero-copy">
            Primeiro painel de validacao: API, banco e criacao de espacos com
            schema proprio por cliente.
          </p>
        </div>

        <div className="hero-card">
          <span className="hero-card-label">Proximo fluxo</span>
          <strong>Criar espaco, cadastrar pessoas e publicar escala.</strong>
          <p>
            A fundacao ja esta preparada para o piloto do Marcelo e para novos
            espacos no modelo SaaS.
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

          <button className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar espaco"}
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
                <article className="tenant-card" key={tenant.id}>
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
                </article>
              ))}
            </div>
          )}
        </section>
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
