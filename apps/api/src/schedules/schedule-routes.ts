import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveTenantContext } from "../tenant-context/tenant-context";
import { createScheduleDraft, listScheduleDrafts } from "./schedule-repository";

const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

const optionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" ? null : value));

const createScheduleSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    locationId: z.string().uuid(),
    functionId: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    requiredCount: z.coerce.number().int().min(1).max(50).default(1),
    meetingPoint: optionalTextSchema,
    instructions: optionalTextSchema,
  })
  .refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
    message: "End date must be after start date.",
    path: ["endsAt"],
  });

export async function scheduleRoutes(app: FastifyInstance) {
  app.get("/tenants/:tenantSlug/schedules", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    return {
      data: await listScheduleDrafts(context.schema),
    };
  });

  app.post("/tenants/:tenantSlug/schedules", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    const input = createScheduleSchema.parse(request.body);
    const schedule = await createScheduleDraft(context.schema, input);

    return reply.code(201).send({
      data: schedule,
    });
  });
}
