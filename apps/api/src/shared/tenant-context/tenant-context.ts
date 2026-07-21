import type { FastifyReply } from "fastify";
import { quoteIdentifier } from "../db/identifiers";
import {
  getTenantBySlug,
  type Tenant,
} from "../../modules/tenants/tenants.repository";

export type TenantContext = {
  tenant: Tenant;
  schema: string;
};

export async function resolveTenantContext(
  tenantSlug: string,
  reply: FastifyReply,
): Promise<TenantContext | null> {
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant || tenant.status !== "active") {
    reply.code(404).send({
      error: "tenant_not_found",
      message: "Tenant not found.",
    });
    return null;
  }

  return {
    tenant,
    schema: quoteIdentifier(tenant.schemaName),
  };
}
