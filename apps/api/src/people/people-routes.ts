import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPerson, listPeople } from "./people-repository";
import { resolveTenantContext } from "../tenant-context/tenant-context";

const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

const createPersonSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .email()
    .max(180)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});

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
