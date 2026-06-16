import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createTenant, listTenants } from "./tenant-repository";

const createTenantSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(60),
  displayName: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).default("America/Sao_Paulo"),
  locale: z.string().trim().min(2).default("pt-BR"),
});

export async function tenantRoutes(app: FastifyInstance) {
  app.get("/tenants", async () => ({
    data: await listTenants(),
  }));

  app.post("/tenants", async (request, reply) => {
    const input = createTenantSchema.parse(request.body);

    try {
      const tenant = await createTenant(input);
      return reply.code(201).send({ data: tenant });
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "23505"
      ) {
        return reply.code(409).send({
          error: "tenant_slug_already_exists",
          message: "A tenant with this slug already exists.",
        });
      }

      throw error;
    }
  });
}
