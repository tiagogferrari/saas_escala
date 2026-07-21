export type AuditChanges = Record<
  string,
  {
    before: unknown;
    after: unknown;
  }
>;

export function addAuditChange(
  changes: AuditChanges,
  field: string,
  before: unknown,
  after: unknown,
) {
  if (!Object.is(before, after)) {
    changes[field] = { before, after };
  }
}
