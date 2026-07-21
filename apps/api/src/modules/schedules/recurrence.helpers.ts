import { ScheduleSeriesError } from "./schedule.errors";
import type { ScheduleSeriesRow } from "./schedule.rows";
import type { CreateScheduleSeriesInput } from "./schedule.types";
import { getDateKey } from "./schedule.utils";

export function buildSeriesOccurrences(
  startsAt: Date,
  endsAt: Date,
  intervalWeeks: number,
  recurrenceEndsOn: string,
) {
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt ||
    intervalWeeks < 1
  ) {
    throw new ScheduleSeriesError(
      "series_invalid",
      "Schedule series has an invalid recurrence.",
    );
  }

  const occurrences: Array<{ startsAt: Date; endsAt: Date; date: string }> = [];
  const intervalMs = intervalWeeks * 7 * 24 * 60 * 60 * 1000;

  for (let index = 0; index < 104; index += 1) {
    const occurrenceStartsAt = new Date(
      startsAt.getTime() + index * intervalMs,
    );
    const occurrenceDate = getDateKey(occurrenceStartsAt);

    if (occurrenceDate > recurrenceEndsOn) {
      return occurrences;
    }

    occurrences.push({
      startsAt: occurrenceStartsAt,
      endsAt: new Date(endsAt.getTime() + index * intervalMs),
      date: occurrenceDate,
    });
  }

  throw new ScheduleSeriesError(
    "series_too_large",
    "Schedule series exceeds the supported occurrence limit.",
  );
}

export function getSeriesOccurrences(input: CreateScheduleSeriesInput) {
  return buildSeriesOccurrences(
    new Date(input.startsAt),
    new Date(input.endsAt),
    input.recurrenceIntervalWeeks,
    input.recurrenceEndsOn,
  );
}

export function getSeriesRowOccurrences(row: ScheduleSeriesRow) {
  return buildSeriesOccurrences(
    row.anchor_starts_at,
    row.anchor_ends_at,
    row.recurrence_interval_weeks,
    getDateKey(row.recurrence_ends_on),
  );
}
