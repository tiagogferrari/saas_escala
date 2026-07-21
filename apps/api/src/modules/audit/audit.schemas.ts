import { z } from "zod";

export const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

export const auditEventsQuerySchema = z.object({
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  entityId: z.string().uuid().optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
