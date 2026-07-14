"use client";

import { useEffect, useMemo, useState } from "react";

export type ScheduleSeriesOccurrence = {
  occurrenceDate: string;
  startsAt: string;
  endsAt: string;
  scheduleId: string | null;
  scheduleStatus: string | null;
  skipped: boolean;
  exceptionNote: string | null;
  cancelledReason: string | null;
  cancelledAt: string | null;
  assignmentCount: number;
};

export type ScheduleSeriesOverview = {
  id: string;
  title: string;
  status: string;
  recurrenceIntervalWeeks: number;
  recurrenceEndsOn: string;
  requiredCount: number;
  location: {
    id: string;
    name: string;
  };
  function: {
    id: string;
    name: string;
  };
  occurrences: ScheduleSeriesOccurrence[];
  createdAt: string;
};

export type ScheduleSeriesOccurrenceUpdatePayload = {
  skipped: boolean;
  note?: string | null;
};

export type ScheduleSeriesAssignmentStatus = "externally_confirmed" | "invited";

type PersonOption = {
  id: string;
  displayName: string;
  status: string;
};

type ScheduleAssignmentOption = {
  id: string;
  assigneeType: "person" | "group";
  assigneeId: string;
  assigneeName: string;
  status: string;
};

type ScheduleOption = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  slot: {
    requiredCount: number;
  };
  assignments: ScheduleAssignmentOption[];
};

type Props = {
  cancellingScheduleId: string | null;
  isAssigning: boolean;
  onAssignPerson: (
    scheduleId: string,
    personId: string,
    status: ScheduleSeriesAssignmentStatus,
  ) => Promise<boolean>;
  onCancelSchedule: (scheduleId: string, reason: string) => Promise<boolean>;
  onPublishSchedule: (scheduleId: string) => Promise<void>;
  onUpdateOccurrence: (
    seriesId: string,
    occurrenceDate: string,
    payload: ScheduleSeriesOccurrenceUpdatePayload,
  ) => Promise<void>;
  people: PersonOption[];
  publishingScheduleId: string | null;
  schedules: ScheduleOption[];
  series: ScheduleSeriesOverview[];
  updatingOccurrenceKey: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00`));
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function recurrenceLabel(intervalWeeks: number) {
  if (intervalWeeks === 1) {
    return "Semanal";
  }

  if (intervalWeeks === 2) {
    return "Quinzenal";
  }

  return `A cada ${intervalWeeks} semanas`;
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

function occurrenceStatusLabel(occurrence: ScheduleSeriesOccurrence) {
  if (occurrence.skipped) {
    return "Pulada";
  }

  if (occurrence.scheduleStatus === "draft") {
    return "Rascunho";
  }

  if (occurrence.scheduleStatus === "published") {
    return "Publicada";
  }

  if (occurrence.scheduleStatus === "cancelled") {
    return "Cancelada";
  }

  return "Sem rascunho";
}

function isActiveAssignmentStatus(status: string) {
  return ["externally_confirmed", "confirmed", "invited", "pending"].includes(
    status,
  );
}

function schedulesOverlap(first: ScheduleOption, second: ScheduleOption) {
  return (
    new Date(first.startsAt) < new Date(second.endsAt) &&
    new Date(first.endsAt) > new Date(second.startsAt)
  );
}

function personHasActiveOverlap(
  personId: string,
  targetSchedule: ScheduleOption,
  schedules: ScheduleOption[],
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

function getAssignablePeople(
  people: PersonOption[],
  targetSchedule: ScheduleOption | null,
  schedules: ScheduleOption[],
) {
  if (!targetSchedule) {
    return [];
  }

  const activePeopleInSchedule = new Set(
    targetSchedule.assignments
      .filter(
        (assignment) =>
          assignment.assigneeType === "person" &&
          isActiveAssignmentStatus(assignment.status),
      )
      .map((assignment) => assignment.assigneeId),
  );

  return people.filter(
    (person) =>
      person.status === "active" &&
      !activePeopleInSchedule.has(person.id) &&
      !personHasActiveOverlap(person.id, targetSchedule, schedules),
  );
}

function getOccurrenceClassName(
  occurrence: ScheduleSeriesOccurrence,
  isSelected: boolean,
) {
  const classNames = ["series-manager-occurrence"];

  if (isSelected) {
    classNames.push("is-selected");
  }

  if (occurrence.skipped) {
    classNames.push("is-skipped");
  } else if (occurrence.scheduleStatus === "cancelled") {
    classNames.push("is-cancelled");
  } else if (occurrence.scheduleStatus === "published") {
    classNames.push("is-published");
  } else if (occurrence.scheduleStatus === "draft") {
    classNames.push("is-draft");
  } else {
    classNames.push("is-muted");
  }

  return classNames.join(" ");
}

export function ScheduleSeriesManager({
  cancellingScheduleId,
  isAssigning,
  onAssignPerson,
  onCancelSchedule,
  onPublishSchedule,
  onUpdateOccurrence,
  people,
  publishingScheduleId,
  schedules,
  series,
  updatingOccurrenceKey,
}: Props) {
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [selectedOccurrenceDate, setSelectedOccurrenceDate] = useState("");
  const [noteByOccurrenceKey, setNoteByOccurrenceKey] = useState<
    Record<string, string>
  >({});
  const [personByOccurrenceKey, setPersonByOccurrenceKey] = useState<
    Record<string, string>
  >({});
  const [statusByOccurrenceKey, setStatusByOccurrenceKey] = useState<
    Record<string, ScheduleSeriesAssignmentStatus>
  >({});

  const selectedSeries = useMemo(
    () => series.find((item) => item.id === selectedSeriesId) ?? series[0],
    [selectedSeriesId, series],
  );
  const selectedOccurrence = useMemo(
    () =>
      selectedSeries?.occurrences.find(
        (occurrence) => occurrence.occurrenceDate === selectedOccurrenceDate,
      ) ?? selectedSeries?.occurrences[0],
    [selectedOccurrenceDate, selectedSeries],
  );
  const selectedSchedule = useMemo(
    () =>
      selectedOccurrence?.scheduleId
        ? (schedules.find(
            (schedule) => schedule.id === selectedOccurrence.scheduleId,
          ) ?? null)
        : null,
    [schedules, selectedOccurrence],
  );
  const activeAssignments = useMemo(
    () =>
      selectedSchedule?.assignments.filter((assignment) =>
        isActiveAssignmentStatus(assignment.status),
      ) ?? [],
    [selectedSchedule],
  );
  const assignablePeople = useMemo(
    () => getAssignablePeople(people, selectedSchedule, schedules),
    [people, schedules, selectedSchedule],
  );

  const selectedOccurrenceKey =
    selectedSeries && selectedOccurrence
      ? `${selectedSeries.id}:${selectedOccurrence.occurrenceDate}`
      : "";
  const persistedNote = selectedOccurrence?.skipped
    ? selectedOccurrence.exceptionNote
    : selectedOccurrence?.cancelledReason;
  const noteValue = selectedOccurrenceKey
    ? (noteByOccurrenceKey[selectedOccurrenceKey] ?? persistedNote ?? "")
    : "";
  const savedPersonId = selectedOccurrenceKey
    ? personByOccurrenceKey[selectedOccurrenceKey]
    : "";
  const selectedPersonId =
    savedPersonId &&
    assignablePeople.some((person) => person.id === savedPersonId)
      ? savedPersonId
      : (assignablePeople[0]?.id ?? "");
  const selectedAssignmentStatus = selectedOccurrenceKey
    ? (statusByOccurrenceKey[selectedOccurrenceKey] ?? "externally_confirmed")
    : "externally_confirmed";
  const canManageAssignments = Boolean(
    selectedOccurrence?.scheduleId &&
    !selectedOccurrence.skipped &&
    ["draft", "published"].includes(selectedOccurrence.scheduleStatus ?? ""),
  );
  const isSelectedOccurrencePublishing =
    selectedOccurrence?.scheduleId === publishingScheduleId;
  const isUpdatingSelectedOccurrence =
    updatingOccurrenceKey === selectedOccurrenceKey;
  const isCancellingSelectedSchedule =
    selectedOccurrence?.scheduleId === cancellingScheduleId;
  const isExplicitlyCancelled = Boolean(
    selectedOccurrence?.scheduleStatus === "cancelled" &&
    !selectedOccurrence.skipped,
  );

  useEffect(() => {
    if (selectedSeries && selectedSeries.id !== selectedSeriesId) {
      setSelectedSeriesId(selectedSeries.id);
    }
  }, [selectedSeries, selectedSeriesId]);

  useEffect(() => {
    if (
      selectedSeries &&
      selectedOccurrence &&
      selectedOccurrence.occurrenceDate !== selectedOccurrenceDate
    ) {
      setSelectedOccurrenceDate(selectedOccurrence.occurrenceDate);
    }
  }, [selectedOccurrence, selectedOccurrenceDate, selectedSeries]);

  function updateNote(value: string) {
    if (!selectedOccurrenceKey) {
      return;
    }

    setNoteByOccurrenceKey((currentNotes) => ({
      ...currentNotes,
      [selectedOccurrenceKey]: value,
    }));
  }

  function updateSelectedPerson(personId: string) {
    if (!selectedOccurrenceKey) {
      return;
    }

    setPersonByOccurrenceKey((currentPeople) => ({
      ...currentPeople,
      [selectedOccurrenceKey]: personId,
    }));
  }

  function updateSelectedAssignmentStatus(
    status: ScheduleSeriesAssignmentStatus,
  ) {
    if (!selectedOccurrenceKey) {
      return;
    }

    setStatusByOccurrenceKey((currentStatuses) => ({
      ...currentStatuses,
      [selectedOccurrenceKey]: status,
    }));
  }

  async function updateSelectedOccurrence(skipped: boolean) {
    if (!selectedSeries || !selectedOccurrence) {
      return;
    }

    await onUpdateOccurrence(
      selectedSeries.id,
      selectedOccurrence.occurrenceDate,
      {
        skipped,
        note: skipped ? noteValue : null,
      },
    );
  }

  async function assignSelectedPerson() {
    if (!selectedOccurrence?.scheduleId || !selectedPersonId) {
      return;
    }

    await onAssignPerson(
      selectedOccurrence.scheduleId,
      selectedPersonId,
      selectedAssignmentStatus,
    );
  }

  async function cancelSelectedSchedule() {
    if (!selectedOccurrence?.scheduleId || noteValue.trim().length < 2) {
      return;
    }

    await onCancelSchedule(selectedOccurrence.scheduleId, noteValue.trim());
  }

  return (
    <section className="panel schedule-series-manager">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Series criadas</p>
          <h2>Gerenciar recorrencias</h2>
        </div>
        <span className="count-badge">{series.length}</span>
      </div>

      {series.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhuma serie recorrente criada ainda.</strong>
          <p>Depois de criar uma serie, as datas aparecem aqui para ajuste.</p>
        </div>
      ) : (
        <div className="series-manager-layout">
          <div className="series-manager-list">
            {series.map((item) => {
              const skippedCount = item.occurrences.filter(
                (occurrence) => occurrence.skipped,
              ).length;
              const publishedCount = item.occurrences.filter(
                (occurrence) => occurrence.scheduleStatus === "published",
              ).length;
              const draftCount = item.occurrences.filter(
                (occurrence) => occurrence.scheduleStatus === "draft",
              ).length;
              const cancelledCount = item.occurrences.filter(
                (occurrence) =>
                  occurrence.scheduleStatus === "cancelled" &&
                  !occurrence.skipped,
              ).length;

              return (
                <button
                  className={`series-manager-card ${
                    item.id === selectedSeries?.id ? "is-selected" : ""
                  }`}
                  key={item.id}
                  onClick={() => {
                    setSelectedSeriesId(item.id);
                    setSelectedOccurrenceDate(
                      item.occurrences[0]?.occurrenceDate ?? "",
                    );
                  }}
                  type="button"
                >
                  <strong>{item.title}</strong>
                  <span>
                    {item.function.name} em {item.location.name}
                  </span>
                  <dl>
                    <div>
                      <dt>Ritmo</dt>
                      <dd>{recurrenceLabel(item.recurrenceIntervalWeeks)}</dd>
                    </div>
                    <div>
                      <dt>Ate</dt>
                      <dd>{item.recurrenceEndsOn}</dd>
                    </div>
                    <div>
                      <dt>Rascunhos</dt>
                      <dd>{draftCount}</dd>
                    </div>
                    <div>
                      <dt>Publicadas</dt>
                      <dd>{publishedCount}</dd>
                    </div>
                    <div>
                      <dt>Puladas</dt>
                      <dd>{skippedCount}</dd>
                    </div>
                    <div>
                      <dt>Canceladas</dt>
                      <dd>{cancelledCount}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{item.occurrences.length}</dd>
                    </div>
                  </dl>
                </button>
              );
            })}
          </div>

          {selectedSeries && selectedOccurrence ? (
            <div className="series-manager-detail">
              <div className="series-manager-detail-header">
                <div>
                  <p className="eyebrow">Datas da serie</p>
                  <strong>{selectedSeries.title}</strong>
                  <span>
                    {selectedSeries.function.name} -{" "}
                    {selectedSeries.location.name}
                  </span>
                </div>
                <span className="series-muted">
                  {selectedSeries.occurrences.length} data(s)
                </span>
              </div>

              <div className="series-manager-occurrences">
                {selectedSeries.occurrences.map((occurrence) => (
                  <button
                    className={getOccurrenceClassName(
                      occurrence,
                      occurrence.occurrenceDate ===
                        selectedOccurrence.occurrenceDate,
                    )}
                    key={occurrence.occurrenceDate}
                    onClick={() =>
                      setSelectedOccurrenceDate(occurrence.occurrenceDate)
                    }
                    type="button"
                  >
                    <strong>{formatDate(occurrence.occurrenceDate)}</strong>
                    <span>
                      {formatTimeRange(occurrence.startsAt, occurrence.endsAt)}
                    </span>
                    <small>{occurrenceStatusLabel(occurrence)}</small>
                    {occurrence.assignmentCount > 0 ? (
                      <small>{occurrence.assignmentCount} pessoa(s)</small>
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="series-manager-editor">
                <div className="series-manager-editor-header">
                  <div>
                    <p className="eyebrow">Data selecionada</p>
                    <strong>
                      {formatDate(selectedOccurrence.occurrenceDate)}
                    </strong>
                    <span>
                      {occurrenceStatusLabel(selectedOccurrence)} -{" "}
                      {formatTimeRange(
                        selectedOccurrence.startsAt,
                        selectedOccurrence.endsAt,
                      )}
                    </span>
                  </div>

                  {selectedOccurrence.scheduleId &&
                  selectedOccurrence.scheduleStatus === "draft" &&
                  !selectedOccurrence.skipped ? (
                    <button
                      className="secondary-button"
                      disabled={isSelectedOccurrencePublishing}
                      onClick={() =>
                        void onPublishSchedule(selectedOccurrence.scheduleId!)
                      }
                      type="button"
                    >
                      {isSelectedOccurrencePublishing
                        ? "Publicando..."
                        : "Publicar data"}
                    </button>
                  ) : null}
                </div>

                {canManageAssignments ? (
                  <div className="series-manager-assignment-box">
                    <div className="series-manager-section-header">
                      <div>
                        <strong>Pessoas nesta data</strong>
                        <span>
                          {activeAssignments.length}/
                          {selectedSchedule?.slot.requiredCount ?? 0} vaga(s)
                        </span>
                      </div>
                    </div>

                    {activeAssignments.length > 0 ? (
                      <div className="series-manager-assignment-list">
                        {activeAssignments.map((assignment) => (
                          <div
                            className="series-manager-assignment-item"
                            key={assignment.id}
                          >
                            <strong>{assignment.assigneeName}</strong>
                            <span>
                              {assignmentStatusLabel(assignment.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state compact-empty">
                        <strong>Ninguem escalado nesta data.</strong>
                      </div>
                    )}

                    <div className="series-manager-assignment-form">
                      <label>
                        Pessoa
                        <select
                          disabled={
                            isAssigning || assignablePeople.length === 0
                          }
                          onChange={(event) =>
                            updateSelectedPerson(event.target.value)
                          }
                          value={selectedPersonId}
                        >
                          {assignablePeople.length === 0 ? (
                            <option value="">Sem pessoa disponivel</option>
                          ) : null}
                          {assignablePeople.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.displayName}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Status inicial
                        <select
                          disabled={isAssigning}
                          onChange={(event) =>
                            updateSelectedAssignmentStatus(
                              event.target
                                .value as ScheduleSeriesAssignmentStatus,
                            )
                          }
                          value={selectedAssignmentStatus}
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
                          isAssigning ||
                          !selectedPersonId ||
                          assignablePeople.length === 0
                        }
                        onClick={() => void assignSelectedPerson()}
                        type="button"
                      >
                        {isAssigning ? "Salvando..." : "Escalar aqui"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="series-manager-warning">
                    {selectedOccurrence.skipped
                      ? "Restaure esta data para voltar a escalar pessoas aqui."
                      : isExplicitlyCancelled
                        ? "Esta escala foi cancelada. As pessoas e os pedidos de substituicao desta data foram encerrados."
                        : "Esta data nao aceita mais alteracoes de pessoas."}
                  </div>
                )}

                {selectedOccurrence.scheduleStatus !== "completed" ? (
                  <label className="series-skip-note">
                    {selectedOccurrence.scheduleStatus === "published" ||
                    isExplicitlyCancelled
                      ? "Motivo do cancelamento"
                      : "Motivo para pular"}
                    <textarea
                      disabled={
                        isUpdatingSelectedOccurrence ||
                        isCancellingSelectedSchedule ||
                        isExplicitlyCancelled
                      }
                      maxLength={500}
                      onChange={(event) => updateNote(event.target.value)}
                      placeholder="Ex.: feriado, retiro, evento especial"
                      rows={3}
                      value={noteValue}
                    />
                  </label>
                ) : null}

                {selectedOccurrence.scheduleStatus === "published" &&
                !selectedOccurrence.skipped ? (
                  <div className="series-manager-warning">
                    Cancelar encerra as atribuicoes e os pedidos de substituicao
                    desta escala. O membro continuara vendo a data como
                    cancelada e o motivo informado.
                  </div>
                ) : null}

                {isExplicitlyCancelled && selectedOccurrence.cancelledAt ? (
                  <div className="series-manager-warning">
                    Cancelada em{" "}
                    {formatDateTime(selectedOccurrence.cancelledAt)}.
                  </div>
                ) : null}

                <div className="series-manager-actions">
                  {selectedOccurrence.skipped ? (
                    <>
                      <button
                        className="secondary-button"
                        disabled={isUpdatingSelectedOccurrence}
                        onClick={() => void updateSelectedOccurrence(true)}
                        type="button"
                      >
                        {isUpdatingSelectedOccurrence
                          ? "Salvando..."
                          : "Salvar motivo"}
                      </button>
                      <button
                        className="ghost-button"
                        disabled={isUpdatingSelectedOccurrence}
                        onClick={() => void updateSelectedOccurrence(false)}
                        type="button"
                      >
                        Restaurar data
                      </button>
                    </>
                  ) : selectedOccurrence.scheduleStatus === "published" &&
                    selectedOccurrence.scheduleId ? (
                    <button
                      className="danger-button"
                      disabled={
                        isCancellingSelectedSchedule ||
                        noteValue.trim().length < 2
                      }
                      onClick={() => void cancelSelectedSchedule()}
                      type="button"
                    >
                      {isCancellingSelectedSchedule
                        ? "Cancelando..."
                        : "Cancelar escala"}
                    </button>
                  ) : selectedOccurrence.scheduleStatus === "draft" ? (
                    <button
                      className="danger-button"
                      disabled={isUpdatingSelectedOccurrence}
                      onClick={() => void updateSelectedOccurrence(true)}
                      type="button"
                    >
                      {isUpdatingSelectedOccurrence
                        ? "Pulando..."
                        : "Pular data"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
