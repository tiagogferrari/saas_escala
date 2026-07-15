import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveTenantContext } from "../tenant-context/tenant-context";
import { listAuditEvents } from "./audit-repository";

const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

const auditEventsQuerySchema = z.object({
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  entityId: z.string().uuid().optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

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
