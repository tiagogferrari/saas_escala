import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createLocation, listLocations } from "./location-repository";
import { resolveTenantContext } from "../tenant-context/tenant-context";

const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(140),
  address: z
    .string()
    .trim()
    .max(240)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
  timezone: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});

export async function locationRoutes(app: FastifyInstance) {
  app.get("/tenants/:tenantSlug/locations", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    return {
      data: await listLocations(context.schema),
    };
  });

  app.post("/tenants/:tenantSlug/locations", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    const input = createLocationSchema.parse(request.body);
    const location = await createLocation(context.schema, input);

    return reply.code(201).send({
      data: location,
    });
  });
}
