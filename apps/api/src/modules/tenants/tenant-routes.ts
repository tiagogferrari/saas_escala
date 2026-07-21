import type { FastifyInstance } from "fastify";
import { createTenant, listTenantsForUser } from "./tenant-repository";
import { createTenantSchema } from "./tenants.schemas";

export async function tenantRoutes(app: FastifyInstance) {
  app.get("/tenants", async (request, reply) => {
    if (!request.managerAuth) {
      return reply.code(401).send({
        error: "authentication_required",
      });
    }

    return {
      data: await listTenantsForUser(request.managerAuth.id),
    };
  });

  app.post("/tenants", async (request, reply) => {
    const input = createTenantSchema.parse(request.body);

    try {
      if (!request.managerAuth) {
        return reply.code(401).send({
          error: "authentication_required",
        });
      }

      const tenant = await createTenant(input, request.managerAuth.id);
      return reply.code(201).send({ data: tenant });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        return reply.code(409).send({
          error: "tenant_slug_already_exists",
          message: "A tenant with this slug already exists.",
        });
      }

      throw error;
    }
  });
}

