"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LocationOption = {
  id: string;
  name: string;
};

type FunctionOption = {
  id: string;
  name: string;
};

type PersonOption = {
  id: string;
  displayName: string;
  status: string;
};

export type ScheduleSeriesCreatePayload = {
  title: string;
  locationId: string;
  functionId: string;
  startsAt: string;
  endsAt: string;
  recurrenceIntervalWeeks: number;
  recurrenceEndsOn: string;
  requiredCount: number;
  skippedDates: string[];
  defaultAssignmentPersonIds: string[];
  occurrenceAssignmentOverrides: Array<{
    occurrenceDate: string;
    personIds: string[];
  }>;
  assignmentStatus: "invited" | "externally_confirmed";
};

type Props = {
  functions: FunctionOption[];
  isSubmitting: boolean;
  locations: LocationOption[];
  onCreate: (payload: ScheduleSeriesCreatePayload) => Promise<boolean>;
  people: PersonOption[];
};

function toDatetimeLocalInputValue(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function getDefaultWindow() {
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

function getDefaultEndsOn() {
  const date = new Date();
  return `${date.getFullYear()}-12-31`;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOccurrenceDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function getOccurrences(
  startsAtValue: string,
  intervalWeeks: number,
  endsOn: string,
) {
  const startsAt = new Date(startsAtValue);
  const endsAt = new Date(`${endsOn}T23:59:59`);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt > endsAt ||
    intervalWeeks < 1
  ) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(startsAt);
  for (let index = 0; index < 104; index += 1) {
    if (cursor > endsAt) {
      break;
    }

    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + intervalWeeks * 7);
  }

  return dates;
}

function groupDatesByMonth(dates: string[]) {
  const monthKeys = [...new Set(dates.map((date) => date.slice(0, 7)))];

  return monthKeys.map((monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    return {
      key: monthKey,
      year: year ?? 0,
      month: (month ?? 1) - 1,
    };
  });
}

function togglePerson(personIds: string[], personId: string) {
  return personIds.includes(personId)
    ? personIds.filter((id) => id !== personId)
    : [...personIds, personId];
}

export function ScheduleSeriesPanel({
  functions,
  isSubmitting,
  locations,
  onCreate,
  people,
}: Props) {
  const defaultWindow = useMemo(() => getDefaultWindow(), []);
  const [title, setTitle] = useState("Abertura");
  const [locationId, setLocationId] = useState("");
  const [functionId, setFunctionId] = useState("");
  const [startsAt, setStartsAt] = useState(defaultWindow.startsAt);
  const [endsAt, setEndsAt] = useState(defaultWindow.endsAt);
  const [intervalMode, setIntervalMode] = useState<
    "weekly" | "biweekly" | "custom"
  >("weekly");
  const [customIntervalWeeks, setCustomIntervalWeeks] = useState(3);
  const [endsOn, setEndsOn] = useState(getDefaultEndsOn);
  const [requiredCount, setRequiredCount] = useState(1);
  const [assignmentStatus, setAssignmentStatus] = useState<
    "invited" | "externally_confirmed"
  >("invited");
  const [basePersonIds, setBasePersonIds] = useState<string[]>([]);
  const [skippedDates, setSkippedDates] = useState<Record<string, boolean>>({});
  const [assignmentOverrides, setAssignmentOverrides] = useState<
    Record<string, string[]>
  >({});
  const [selectedOccurrenceDate, setSelectedOccurrenceDate] = useState<
    string | null
  >(null);

  const intervalWeeks =
    intervalMode === "weekly"
      ? 1
      : intervalMode === "biweekly"
        ? 2
        : customIntervalWeeks;
  const occurrenceDates = useMemo(
    () => getOccurrences(startsAt, intervalWeeks, endsOn),
    [endsOn, intervalWeeks, startsAt],
  );
  const occurrenceDateSet = useMemo(
    () => new Set(occurrenceDates),
    [occurrenceDates],
  );
  const activePeople = useMemo(
    () => people.filter((person) => person.status === "active"),
    [people],
  );
  const monthGroups = useMemo(
    () => groupDatesByMonth(occurrenceDates),
    [occurrenceDates],
  );
  const skippedDateKeys = useMemo(
    () =>
      Object.entries(skippedDates)
        .filter(([, isSkipped]) => isSkipped)
        .map(([date]) => date)
        .filter((date) => occurrenceDateSet.has(date)),
    [occurrenceDateSet, skippedDates],
  );
  const selectedOccurrencePersonIds = selectedOccurrenceDate
    ? (assignmentOverrides[selectedOccurrenceDate] ?? basePersonIds)
    : [];

  useEffect(() => {
    if (!locations.some((location) => location.id === locationId)) {
      setLocationId(locations[0]?.id ?? "");
    }
  }, [locationId, locations]);

  useEffect(() => {
    if (
      !functions.some((scheduleFunction) => scheduleFunction.id === functionId)
    ) {
      setFunctionId(functions[0]?.id ?? "");
    }
  }, [functionId, functions]);

  useEffect(() => {
    if (
      selectedOccurrenceDate &&
      !occurrenceDateSet.has(selectedOccurrenceDate)
    ) {
      setSelectedOccurrenceDate(null);
    }
  }, [occurrenceDateSet, selectedOccurrenceDate]);

  function toggleSkippedDate(date: string) {
    setSkippedDates((currentDates) => ({
      ...currentDates,
      [date]: !currentDates[date],
    }));

    if (!skippedDates[date]) {
      setAssignmentOverrides((currentOverrides) => {
        const nextOverrides = { ...currentOverrides };
        delete nextOverrides[date];
        return nextOverrides;
      });
    }
  }

  function toggleBasePerson(personId: string) {
    setBasePersonIds((currentPersonIds) =>
      togglePerson(currentPersonIds, personId),
    );
  }

  function toggleOccurrencePerson(personId: string) {
    if (!selectedOccurrenceDate) {
      return;
    }

    setAssignmentOverrides((currentOverrides) => ({
      ...currentOverrides,
      [selectedOccurrenceDate]: togglePerson(
        currentOverrides[selectedOccurrenceDate] ?? basePersonIds,
        personId,
      ),
    }));
  }

  function clearOccurrenceOverride() {
    if (!selectedOccurrenceDate) {
      return;
    }

    setAssignmentOverrides((currentOverrides) => {
      const nextOverrides = { ...currentOverrides };
      delete nextOverrides[selectedOccurrenceDate];
      return nextOverrides;
    });
  }

  async function submitSeries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const didCreate = await onCreate({
      title,
      locationId,
      functionId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      recurrenceIntervalWeeks: intervalWeeks,
      recurrenceEndsOn: endsOn,
      requiredCount,
      skippedDates: skippedDateKeys,
      defaultAssignmentPersonIds: basePersonIds,
      occurrenceAssignmentOverrides: Object.entries(assignmentOverrides)
        .filter(([date]) => occurrenceDateSet.has(date) && !skippedDates[date])
        .map(([occurrenceDate, personIds]) => ({
          occurrenceDate,
          personIds,
        })),
      assignmentStatus,
    });

    if (didCreate) {
      setSkippedDates({});
      setAssignmentOverrides({});
      setSelectedOccurrenceDate(null);
    }
  }

  return (
    <form className="panel schedule-series-panel" onSubmit={submitSeries}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Planejamento recorrente</p>
          <h2>Criar serie de escalas</h2>
        </div>
        <span className="count-badge">{occurrenceDates.length}</span>
      </div>

      <div className="form-grid">
        <label className="full-field">
          Titulo
          <input
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>

        <label>
          Local
          <select
            disabled={locations.length === 0}
            onChange={(event) => setLocationId(event.target.value)}
            required
            value={locationId}
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
            disabled={functions.length === 0}
            onChange={(event) => setFunctionId(event.target.value)}
            required
            value={functionId}
          >
            {functions.length === 0 ? (
              <option value="">Nenhuma funcao</option>
            ) : null}
            {functions.map((scheduleFunction) => (
              <option key={scheduleFunction.id} value={scheduleFunction.id}>
                {scheduleFunction.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Primeiro inicio
          <input
            onChange={(event) => setStartsAt(event.target.value)}
            required
            type="datetime-local"
            value={startsAt}
          />
        </label>

        <label>
          Primeiro fim
          <input
            onChange={(event) => setEndsAt(event.target.value)}
            required
            type="datetime-local"
            value={endsAt}
          />
        </label>

        <fieldset className="full-field series-fieldset">
          <legend>Repeticao</legend>
          <div className="segmented-control" role="group">
            <button
              className={intervalMode === "weekly" ? "is-selected" : ""}
              onClick={() => setIntervalMode("weekly")}
              type="button"
            >
              Semanal
            </button>
            <button
              className={intervalMode === "biweekly" ? "is-selected" : ""}
              onClick={() => setIntervalMode("biweekly")}
              type="button"
            >
              Quinzenal
            </button>
            <button
              className={intervalMode === "custom" ? "is-selected" : ""}
              onClick={() => setIntervalMode("custom")}
              type="button"
            >
              Personalizar
            </button>
          </div>
          {intervalMode === "custom" ? (
            <label className="series-inline-field">
              A cada quantas semanas
              <input
                max={12}
                min={1}
                onChange={(event) =>
                  setCustomIntervalWeeks(
                    Math.max(1, Number(event.target.value) || 1),
                  )
                }
                type="number"
                value={customIntervalWeeks}
              />
            </label>
          ) : null}
        </fieldset>

        <label>
          Repetir ate
          <input
            min={startsAt.slice(0, 10)}
            onChange={(event) => setEndsOn(event.target.value)}
            required
            type="date"
            value={endsOn}
          />
        </label>

        <label>
          Vagas por data
          <input
            max={50}
            min={1}
            onChange={(event) =>
              setRequiredCount(Math.max(1, Number(event.target.value) || 1))
            }
            required
            type="number"
            value={requiredCount}
          />
        </label>

        <label>
          Status inicial
          <select
            onChange={(event) =>
              setAssignmentStatus(
                event.target.value as "invited" | "externally_confirmed",
              )
            }
            value={assignmentStatus}
          >
            <option value="invited">Convidado</option>
            <option value="externally_confirmed">Confirmado pelo gestor</option>
          </select>
        </label>
      </div>

      <div className="series-people-section">
        <div className="series-section-header">
          <div>
            <p className="eyebrow">Equipe-base</p>
            <strong>{basePersonIds.length} pessoa(s) em todas as datas</strong>
          </div>
        </div>
        <div className="series-person-list">
          {activePeople.map((person) => (
            <label className="series-person-option" key={person.id}>
              <input
                checked={basePersonIds.includes(person.id)}
                onChange={() => toggleBasePerson(person.id)}
                type="checkbox"
              />
              <span>{person.displayName}</span>
            </label>
          ))}
          {activePeople.length === 0 ? (
            <span className="series-muted">
              Nenhuma pessoa ativa cadastrada.
            </span>
          ) : null}
        </div>
      </div>

      <div className="series-preview-header">
        <div>
          <p className="eyebrow">Ocorrencias</p>
          <strong>
            {occurrenceDates.length - skippedDateKeys.length} rascunho(s) serao
            criados
          </strong>
        </div>
        {skippedDateKeys.length > 0 ? (
          <span className="series-muted">
            {skippedDateKeys.length} data(s) pulada(s)
          </span>
        ) : null}
      </div>

      <div className="series-calendar-grid">
        {monthGroups.map((group) => {
          const daysInMonth = new Date(
            group.year,
            group.month + 1,
            0,
          ).getDate();
          const firstDayOffset =
            (new Date(group.year, group.month, 1).getDay() + 6) % 7;

          return (
            <section className="series-month" key={group.key}>
              <strong>
                {new Intl.DateTimeFormat("pt-BR", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(group.year, group.month, 1))}
              </strong>
              <div className="series-weekdays" aria-hidden="true">
                <span>S</span>
                <span>T</span>
                <span>Q</span>
                <span>Q</span>
                <span>S</span>
                <span>S</span>
                <span>D</span>
              </div>
              <div className="series-calendar-days">
                {Array.from({ length: firstDayOffset }).map((_, index) => (
                  <span className="series-empty-day" key={`empty-${index}`} />
                ))}
                {Array.from(
                  { length: daysInMonth },
                  (_, index) => index + 1,
                ).map((day) => {
                  const date = toDateKey(
                    new Date(group.year, group.month, day),
                  );
                  const isOccurrence = occurrenceDateSet.has(date);
                  const isSkipped = skippedDates[date] ?? false;
                  const hasOverride = Boolean(assignmentOverrides[date]);
                  const className = [
                    "series-calendar-day",
                    isOccurrence ? "is-occurrence" : "",
                    isSkipped ? "is-skipped" : "",
                    selectedOccurrenceDate === date ? "is-selected" : "",
                    hasOverride ? "has-override" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return isOccurrence ? (
                    <button
                      aria-label={formatOccurrenceDate(date)}
                      className={className}
                      key={date}
                      onClick={() => setSelectedOccurrenceDate(date)}
                      type="button"
                    >
                      {day}
                    </button>
                  ) : (
                    <span className={className} key={date}>
                      {day}
                    </span>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selectedOccurrenceDate ? (
        <section className="series-occurrence-editor">
          <div className="series-section-header">
            <div>
              <p className="eyebrow">Data selecionada</p>
              <strong>{formatOccurrenceDate(selectedOccurrenceDate)}</strong>
            </div>
            <button
              className="ghost-button"
              onClick={() => toggleSkippedDate(selectedOccurrenceDate)}
              type="button"
            >
              {skippedDates[selectedOccurrenceDate]
                ? "Restaurar data"
                : "Pular data"}
            </button>
          </div>

          {!skippedDates[selectedOccurrenceDate] ? (
            <>
              <div className="series-section-header series-occurrence-actions">
                <strong>Equipe desta data</strong>
                {assignmentOverrides[selectedOccurrenceDate] ? (
                  <button
                    className="ghost-button"
                    onClick={clearOccurrenceOverride}
                    type="button"
                  >
                    Usar equipe-base
                  </button>
                ) : null}
              </div>
              <div className="series-person-list">
                {activePeople.map((person) => (
                  <label className="series-person-option" key={person.id}>
                    <input
                      checked={selectedOccurrencePersonIds.includes(person.id)}
                      onChange={() => toggleOccurrencePerson(person.id)}
                      type="checkbox"
                    />
                    <span>{person.displayName}</span>
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <button
        className="primary-button"
        disabled={
          isSubmitting ||
          locations.length === 0 ||
          functions.length === 0 ||
          occurrenceDates.length === 0
        }
      >
        {isSubmitting ? "Criando serie..." : "Criar rascunhos"}
      </button>
    </form>
  );
}
