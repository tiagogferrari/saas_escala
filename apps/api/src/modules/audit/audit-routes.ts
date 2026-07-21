import type { FastifyInstance } from "fastify";
import { resolveTenantContext } from "../../shared/tenant-context/tenant-context";
import { listAuditEvents } from "./audit-repository";
import {
  auditEventsQuerySchema,
  tenantParamsSchema,
} from "./audit.schemas";

export async function auditRoutes(app: FastifyInstance) {
  app.get("/tenants/:tenantSlug/audit-events", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const query = auditEventsQuerySchema.parse(request.query);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    return {
      data: await listAuditEvents(context.schema, query),
    };
  });
}

