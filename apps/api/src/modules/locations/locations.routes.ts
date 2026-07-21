import type { FastifyInstance } from "fastify";
import { createLocation, listLocations } from "./locations.repository";
import { resolveTenantContext } from "../../shared/tenant-context/tenant-context";
import { createLocationSchema, tenantParamsSchema } from "./locations.schemas";

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
