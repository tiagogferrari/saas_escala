export function getDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function normalizeOptionalText(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

export function uniquePersonIds(personIds: string[]) {
  return [...new Set(personIds)];
}
