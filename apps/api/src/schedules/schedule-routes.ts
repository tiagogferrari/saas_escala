import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { resolveTenantContext } from "../tenant-context/tenant-context";
import {
  createScheduleAssignment,
  createScheduleDraft,
  listScheduleAssignments,
  listScheduleDrafts,
  publishSchedule,
  ScheduleAssignmentError,
  SchedulePublicationError,
} from "./schedule-repository";

const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

const scheduleParamsSchema = tenantParamsSchema.extend({
  scheduleId: z.string().uuid(),
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

const createAssignmentSchema = z.object({
  personId: z.string().uuid(),
  status: z.enum(["invited", "externally_confirmed"]).default(
    "externally_confirmed",
  ),
});

function sendAssignmentError(error: ScheduleAssignmentError, reply: FastifyReply) {
  if (error.code === "person_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Pessoa nao encontrada.",
    });
  }

  if (error.code === "schedule_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Escala nao encontrada.",
    });
  }

  if (error.code === "assignment_already_exists") {
    return reply.code(409).send({
      error: error.code,
      message: "Pessoa ja esta escalada nesta escala.",
    });
  }

  if (error.code === "schedule_not_draft") {
    return reply.code(409).send({
      error: error.code,
      message: "Apenas escalas em rascunho podem receber novas pessoas.",
    });
  }

  return reply.code(409).send({
    error: error.code,
    message: "Todas as vagas desta escala ja foram preenchidas.",
  });
}

function sendPublicationError(error: SchedulePublicationError, reply: FastifyReply) {
  if (error.code === "schedule_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Escala nao encontrada.",
    });
  }

  if (error.code === "schedule_not_ready") {
    return reply.code(409).send({
      error: error.code,
      message: "Preencha todas as vagas antes de publicar.",
    });
  }

  return reply.code(409).send({
    error: error.code,
    message: "Apenas escalas em rascunho podem ser publicadas.",
  });
}

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

  app.post(
    "/tenants/:tenantSlug/schedules/:scheduleId/publish",
    async (request, reply) => {
      const params = scheduleParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      try {
        const schedule = await publishSchedule(context.schema, params.scheduleId);

        return {
          data: schedule,
        };
      } catch (error) {
        if (error instanceof SchedulePublicationError) {
          return sendPublicationError(error, reply);
        }

        throw error;
      }
    },
  );

  app.get(
    "/tenants/:tenantSlug/schedules/:scheduleId/assignments",
    async (request, reply) => {
      const params = scheduleParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      try {
        return {
          data: await listScheduleAssignments(context.schema, params.scheduleId),
        };
      } catch (error) {
        if (error instanceof ScheduleAssignmentError) {
          return sendAssignmentError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/schedules/:scheduleId/assignments",
    async (request, reply) => {
      const params = scheduleParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = createAssignmentSchema.parse(request.body);

      try {
        const assignment = await createScheduleAssignment(
          context.schema,
          params.scheduleId,
          input,
        );

        return reply.code(201).send({
          data: assignment,
        });
      } catch (error) {
        if (error instanceof ScheduleAssignmentError) {
          return sendAssignmentError(error, reply);
        }

        throw error;
      }
    },
  );
}
