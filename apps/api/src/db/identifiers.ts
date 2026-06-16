export function quoteIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid database identifier: ${identifier}`);
  }

  return `"${identifier.replaceAll('"', '""')}"`;
}

export function createTenantSchemaName(id: string) {
  return `tenant_${id.replaceAll("-", "")}`;
}
