import type { FastifyInstance } from "fastify";
import { createPerson, listPeople } from "./people-repository";
import { resolveTenantContext } from "../../shared/tenant-context/tenant-context";
import { createPersonSchema, tenantParamsSchema } from "./people.schemas";

export async function peopleRoutes(app: FastifyInstance) {
  app.get("/tenants/:tenantSlug/people", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    return {
      data: await listPeople(context.schema),
    };
  });

  app.post("/tenants/:tenantSlug/people", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    const input = createPersonSchema.parse(request.body);
    const person = await createPerson(context.schema, input);

    return reply.code(201).send({
      data: person,
    });
  });
}

