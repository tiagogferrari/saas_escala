import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { resolveTenantContext } from "../../shared/tenant-context/tenant-context";
import {
  createMemberAccessToken,
  MemberAccessError,
  validateMemberAccessToken,
} from "./member-access-repository";
import {
  createReplacementRequest,
  listMemberSchedules,
  MemberScheduleError,
  respondToMemberScheduleAssignment,
} from "../schedules/schedule-repository";

const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

const personParamsSchema = tenantParamsSchema.extend({
  personId: z.string().uuid(),
});

const accessTokenParamsSchema = tenantParamsSchema.extend({
  accessToken: z.string().min(20).max(200),
});

const accessAssignmentParamsSchema = accessTokenParamsSchema.extend({
  assignmentId: z.string().uuid(),
});

const respondAssignmentSchema = z.object({
  status: z.enum(["confirmed", "declined"]),
});

const createReplacementRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
  urgent: z.boolean().optional().default(false),
});

function sendMemberAccessError(error: MemberAccessError, reply: FastifyReply) {
  if (error.code === "person_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Pessoa nao encontrada.",
    });
  }

  return reply.code(401).send({
    error: error.code,
    message: "Link de acesso invalido ou expirado.",
  });
}

function sendMemberScheduleError(
  error: MemberScheduleError,
  reply: FastifyReply,
) {
  if (error.code === "assignment_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Escala do membro nao encontrada.",
    });
  }

  if (error.code === "replacement_request_already_exists") {
    return reply.code(409).send({
      error: error.code,
      message: "Ja existe um pedido de substituicao em aberto.",
    });
  }

  return reply.code(409).send({
    error: error.code,
    message: "Essa acao nao esta disponivel para essa escala.",
  });
}

export async function memberAccessRoutes(app: FastifyInstance) {
  app.post(
    "/tenants/:tenantSlug/people/:personId/access-links",
    async (request, reply) => {
      const params = personParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      try {
        return reply.code(201).send({
          data: await createMemberAccessToken(context.schema, params.personId),
        });
      } catch (error) {
        if (error instanceof MemberAccessError) {
          return sendMemberAccessError(error, reply);
        }

        throw error;
      }
    },
  );

  app.get(
    "/tenants/:tenantSlug/member-access/:accessToken/schedules",
    async (request, reply) => {
      const params = accessTokenParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      try {
        const person = await validateMemberAccessToken(
          context.schema,
          params.accessToken,
        );

        return {
          data: {
            person,
            schedules: await listMemberSchedules(context.schema, person.id),
          },
        };
      } catch (error) {
        if (error instanceof MemberAccessError) {
          return sendMemberAccessError(error, reply);
        }

        if (error instanceof MemberScheduleError) {
          return sendMemberScheduleError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/member-access/:accessToken/assignments/:assignmentId/respond",
    async (request, reply) => {
      const params = accessAssignmentParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = respondAssignmentSchema.parse(request.body);

      try {
        const person = await validateMemberAccessToken(
          context.schema,
          params.accessToken,
        );

        return {
          data: {
            person,
            schedules: await respondToMemberScheduleAssignment(
              context.schema,
              person.id,
              params.assignmentId,
              input.status,
              {
                type: "member",
                personId: person.id,
                displayName: person.displayName,
              },
            ),
          },
        };
      } catch (error) {
        if (error instanceof MemberAccessError) {
          return sendMemberAccessError(error, reply);
        }

        if (error instanceof MemberScheduleError) {
          return sendMemberScheduleError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/member-access/:accessToken/assignments/:assignmentId/replacement-requests",
    async (request, reply) => {
      const params = accessAssignmentParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = createReplacementRequestSchema.parse(request.body);

      try {
        const person = await validateMemberAccessToken(
          context.schema,
          params.accessToken,
        );

        return {
          data: {
            person,
            schedules: await createReplacementRequest(
              context.schema,
              person.id,
              params.assignmentId,
              input,
              {
                type: "member",
                personId: person.id,
                displayName: person.displayName,
              },
            ),
          },
        };
      } catch (error) {
        if (error instanceof MemberAccessError) {
          return sendMemberAccessError(error, reply);
        }

        if (error instanceof MemberScheduleError) {
          return sendMemberScheduleError(error, reply);
        }

        throw error;
      }
    },
  );
}

