export type Tenant = {
  id: string;
  slug: string;
  displayName: string;
  schemaName: string;
  timezone: string;
  locale: string;
  status: string;
  createdAt: string;
};

export type CreateTenantInput = {
  slug: string;
  displayName: string;
  timezone: string;
  locale: string;
};
