import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { resolveTenantContext } from "../tenant-context/tenant-context";
import {
  NotificationError,
  resendScheduleInvitation,
  sendScheduleInvitations,
} from "../notifications/notification-service";
import {
  cancelSchedule,
  cancelScheduleSeries,
  completeReplacementRequest,
  createReplacementRequest,
  createScheduleAssignment,
  createScheduleDraft,
  createScheduleSeries,
  inviteReplacementCandidate,
  listMemberSchedules,
  listScheduleAssignments,
  listScheduleDrafts,
  listScheduleSeries,
  MemberScheduleError,
  publishSchedule,
  ReplacementRequestManagerError,
  respondToMemberScheduleAssignment,
  ScheduleAssignmentError,
  ScheduleCancellationError,
  SchedulePublicationError,
  ScheduleSeriesError,
  updateScheduleSeries,
  updateScheduleSeriesOccurrenceDetails,
  updateScheduleSeriesOccurrence,
} from "./schedule-repository";

const occurrenceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

const scheduleParamsSchema = tenantParamsSchema.extend({
  scheduleId: z.string().uuid(),
});

const scheduleSeriesParamsSchema = tenantParamsSchema.extend({
  seriesId: z.string().uuid(),
});

const scheduleSeriesOccurrenceParamsSchema = scheduleSeriesParamsSchema.extend({
  occurrenceDate: occurrenceDateSchema,
});

const assignmentInvitationParamsSchema = scheduleParamsSchema.extend({
  assignmentId: z.string().uuid(),
});

const memberParamsSchema = tenantParamsSchema.extend({
  personId: z.string().uuid(),
});

const memberResponseParamsSchema = memberParamsSchema.extend({
  assignmentId: z.string().uuid(),
});

const replacementRequestParamsSchema = tenantParamsSchema.extend({
  replacementRequestId: z.string().uuid(),
});

const optionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
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

const createScheduleSeriesSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    locationId: z.string().uuid(),
    functionId: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    recurrenceIntervalWeeks: z.coerce.number().int().min(1).max(12),
    recurrenceEndsOn: occurrenceDateSchema,
    requiredCount: z.coerce.number().int().min(1).max(50).default(1),
    meetingPoint: optionalTextSchema,
    instructions: optionalTextSchema,
    skippedDates: z.array(occurrenceDateSchema).max(104).default([]),
    skippedOccurrences: z
      .array(
        z.object({
          occurrenceDate: occurrenceDateSchema,
          note: optionalTextSchema,
        }),
      )
      .max(104)
      .default([]),
    defaultAssignmentPersonIds: z.array(z.string().uuid()).max(50).default([]),
    occurrenceAssignmentOverrides: z
      .array(
        z.object({
          occurrenceDate: occurrenceDateSchema,
          personIds: z.array(z.string().uuid()).max(50),
        }),
      )
      .max(104)
      .default([]),
    assignmentStatus: z
      .enum(["invited", "externally_confirmed"])
      .default("invited"),
  })
  .refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
    message: "End date must be after start date.",
    path: ["endsAt"],
  });

const updateScheduleSeriesOccurrenceSchema = z.object({
  skipped: z.boolean(),
  note: optionalTextSchema,
});

const updateScheduleSeriesOccurrenceDetailsSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    locationId: z.string().uuid().optional(),
    functionId: z.string().uuid().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    requiredCount: z.coerce.number().int().min(1).max(50).optional(),
    meetingPoint: optionalTextSchema,
    instructions: optionalTextSchema,
  })
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      new Date(value.startsAt) < new Date(value.endsAt),
    {
      message: "End date must be after start date.",
      path: ["endsAt"],
    },
  );

const updateScheduleSeriesSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    locationId: z.string().uuid().optional(),
    functionId: z.string().uuid().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    recurrenceIntervalWeeks: z.coerce.number().int().min(1).max(12).optional(),
    recurrenceEndsOn: occurrenceDateSchema.optional(),
    requiredCount: z.coerce.number().int().min(1).max(50).optional(),
    meetingPoint: optionalTextSchema,
    instructions: optionalTextSchema,
    applyFrom: occurrenceDateSchema.optional(),
  })
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      new Date(value.startsAt) < new Date(value.endsAt),
    {
      message: "End date must be after start date.",
      path: ["endsAt"],
    },
  );

const cancelScheduleSeriesSchema = z.object({
  cancelFrom: occurrenceDateSchema,
  note: optionalTextSchema,
});

const cancelScheduleSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});

const createAssignmentSchema = z.object({
  personId: z.string().uuid(),
  status: z
    .enum(["invited", "externally_confirmed"])
    .default("externally_confirmed"),
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

const inviteReplacementCandidateSchema = z.object({
  personId: z.string().uuid(),
});

function sendAssignmentError(
  error: ScheduleAssignmentError,
  reply: FastifyReply,
) {
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

  if (error.code === "person_unavailable") {
    return reply.code(409).send({
      error: error.code,
      message: "Pessoa ja esta escalada em outro horario conflitante.",
    });
  }

  if (error.code === "schedule_not_assignable") {
    return reply.code(409).send({
      error: error.code,
      message: "Essa escala nao pode receber novas pessoas.",
    });
  }

  return reply.code(409).send({
    error: error.code,
    message: "Todas as vagas desta escala ja foram preenchidas.",
  });
}

function sendReplacementRequestManagerError(
  error: ReplacementRequestManagerError,
  reply: FastifyReply,
) {
  if (error.code === "person_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Pessoa nao encontrada.",
    });
  }

  if (error.code === "replacement_request_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Pedido de substituicao nao encontrado.",
    });
  }

  if (error.code === "assignment_already_exists") {
    return reply.code(409).send({
      error: error.code,
      message: "Pessoa ja esta nessa escala.",
    });
  }

  if (error.code === "replacement_candidate_not_confirmed") {
    return reply.code(409).send({
      error: error.code,
      message: "Ainda nao existe substituto confirmado para concluir.",
    });
  }

  if (error.code === "person_unavailable") {
    return reply.code(409).send({
      error: error.code,
      message: "Pessoa ja esta escalada em outro horario conflitante.",
    });
  }

  if (error.code === "replacement_request_not_open") {
    return reply.code(409).send({
      error: error.code,
      message: "Esse pedido de substituicao nao esta aberto.",
    });
  }

  return reply.code(409).send({
    error: error.code,
    message: "Essa escala nao pode receber substituto.",
  });
}

function sendMemberScheduleError(
  error: MemberScheduleError,
  reply: FastifyReply,
) {
  if (error.code === "person_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Pessoa nao encontrada.",
    });
  }

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

function sendPublicationError(
  error: SchedulePublicationError,
  reply: FastifyReply,
) {
  if (error.code === "schedule_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Escala nao encontrada.",
    });
  }

  return reply.code(409).send({
    error: error.code,
    message: "Apenas escalas em rascunho podem ser publicadas.",
  });
}

function sendCancellationError(
  error: ScheduleCancellationError,
  reply: FastifyReply,
) {
  if (error.code === "schedule_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Escala nao encontrada.",
    });
  }

  if (error.code === "schedule_already_cancelled") {
    return reply.code(409).send({
      error: error.code,
      message: "Essa escala ja foi cancelada.",
    });
  }

  return reply.code(409).send({
    error: error.code,
    message: "Apenas escalas publicadas podem ser canceladas.",
  });
}

function sendScheduleSeriesError(
  error: ScheduleSeriesError,
  reply: FastifyReply,
) {
  if (error.code === "series_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Serie de escalas nao encontrada.",
    });
  }

  if (error.code === "person_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Uma ou mais pessoas nao estao disponiveis.",
    });
  }

  if (error.code === "person_unavailable") {
    return reply.code(409).send({
      error: error.code,
      message: "Uma pessoa tem conflito de horario em uma das datas.",
    });
  }

  if (error.code === "series_too_large") {
    return reply.code(400).send({
      error: error.code,
      message: "A serie pode gerar no maximo 104 ocorrencias.",
    });
  }

  if (error.code === "series_already_archived") {
    return reply.code(409).send({
      error: error.code,
      message: "Essa serie ja foi encerrada.",
    });
  }

  if (error.code === "series_reference_not_found") {
    return reply.code(404).send({
      error: error.code,
      message: "Local ou funcao nao encontrados.",
    });
  }

  if (error.code === "occurrence_capacity_below_assignments") {
    return reply.code(409).send({
      error: error.code,
      message:
        "A quantidade de vagas nao pode ficar abaixo das pessoas escaladas.",
    });
  }

  if (error.code === "occurrence_function_locked") {
    return reply.code(409).send({
      error: error.code,
      message:
        "Remova ou realoque as pessoas antes de alterar a funcao dessa data.",
    });
  }

  if (error.code === "occurrence_not_editable") {
    return reply.code(409).send({
      error: error.code,
      message: "Essa ocorrencia nao pode ser editada.",
    });
  }

  if (error.code === "occurrence_not_skippable") {
    return reply.code(409).send({
      error: error.code,
      message:
        "Uma escala publicada deve ser cancelada pela acao Cancelar escala.",
    });
  }

  if (error.code === "occurrence_not_restorable") {
    return reply.code(409).send({
      error: error.code,
      message: "Uma escala cancelada nao pode ser restaurada como data pulada.",
    });
  }

  return reply.code(400).send({
    error: error.code,
    message: "Confira as datas, excecoes e pessoas da serie.",
  });
}

function sendNotificationError(error: NotificationError, reply: FastifyReply) {
  if (error.code === "person_without_email") {
    return reply.code(409).send({
      error: error.code,
      message: "Cadastre um e-mail para enviar o convite.",
    });
  }

  return reply.code(409).send({
    error: error.code,
    message: "Esse convite nao pode mais ser enviado.",
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

  app.get("/tenants/:tenantSlug/schedule-series", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    return {
      data: await listScheduleSeries(context.schema),
    };
  });

  app.post("/tenants/:tenantSlug/schedule-series", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    const input = createScheduleSeriesSchema.parse(request.body);

    try {
      const series = await createScheduleSeries(context.schema, input);
      return reply.code(201).send({ data: series });
    } catch (error) {
      if (error instanceof ScheduleSeriesError) {
        return sendScheduleSeriesError(error, reply);
      }

      throw error;
    }
  });

  app.patch(
    "/tenants/:tenantSlug/schedule-series/:seriesId",
    async (request, reply) => {
      const params = scheduleSeriesParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = updateScheduleSeriesSchema.parse(request.body);

      try {
        return {
          data: await updateScheduleSeries(
            context.schema,
            params.seriesId,
            input,
          ),
        };
      } catch (error) {
        if (error instanceof ScheduleSeriesError) {
          return sendScheduleSeriesError(error, reply);
        }

        throw error;
      }
    },
  );

  app.patch(
    "/tenants/:tenantSlug/schedule-series/:seriesId/occurrences/:occurrenceDate/details",
    async (request, reply) => {
      const params = scheduleSeriesOccurrenceParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = updateScheduleSeriesOccurrenceDetailsSchema.parse(
        request.body,
      );

      try {
        return {
          data: await updateScheduleSeriesOccurrenceDetails(
            context.schema,
            params.seriesId,
            params.occurrenceDate,
            input,
          ),
        };
      } catch (error) {
        if (error instanceof ScheduleSeriesError) {
          return sendScheduleSeriesError(error, reply);
        }

        throw error;
      }
    },
  );

  app.patch(
    "/tenants/:tenantSlug/schedule-series/:seriesId/occurrences/:occurrenceDate",
    async (request, reply) => {
      const params = scheduleSeriesOccurrenceParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = updateScheduleSeriesOccurrenceSchema.parse(request.body);

      try {
        const series = await updateScheduleSeriesOccurrence(
          context.schema,
          params.seriesId,
          params.occurrenceDate,
          input,
        );

        return {
          data: series,
        };
      } catch (error) {
        if (error instanceof ScheduleSeriesError) {
          return sendScheduleSeriesError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/schedule-series/:seriesId/cancel",
    async (request, reply) => {
      const params = scheduleSeriesParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = cancelScheduleSeriesSchema.parse(request.body);

      try {
        return {
          data: await cancelScheduleSeries(
            context.schema,
            params.seriesId,
            input,
          ),
        };
      } catch (error) {
        if (error instanceof ScheduleSeriesError) {
          return sendScheduleSeriesError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/schedules/:scheduleId/publish",
    async (request, reply) => {
      const params = scheduleParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      try {
        const schedule = await publishSchedule(
          context.schema,
          params.scheduleId,
        );
        const notifications = await sendScheduleInvitations(
          context.schema,
          context.tenant,
          schedule.id,
        );

        return {
          data: {
            schedule,
            notifications,
          },
        };
      } catch (error) {
        if (error instanceof SchedulePublicationError) {
          return sendPublicationError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/schedules/:scheduleId/cancel",
    async (request, reply) => {
      const params = scheduleParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = cancelScheduleSchema.parse(request.body);

      try {
        return {
          data: await cancelSchedule(context.schema, params.scheduleId, input),
        };
      } catch (error) {
        if (error instanceof ScheduleCancellationError) {
          return sendCancellationError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/schedules/:scheduleId/assignments/:assignmentId/invitations",
    async (request, reply) => {
      const params = assignmentInvitationParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      try {
        return {
          data: await resendScheduleInvitation(
            context.schema,
            context.tenant,
            params.assignmentId,
          ),
        };
      } catch (error) {
        if (error instanceof NotificationError) {
          return sendNotificationError(error, reply);
        }

        throw error;
      }
    },
  );

  app.get(
    "/tenants/:tenantSlug/people/:personId/member-schedules",
    async (request, reply) => {
      const params = memberParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      try {
        return {
          data: await listMemberSchedules(context.schema, params.personId),
        };
      } catch (error) {
        if (error instanceof MemberScheduleError) {
          return sendMemberScheduleError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/people/:personId/assignments/:assignmentId/respond",
    async (request, reply) => {
      const params = memberResponseParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = respondAssignmentSchema.parse(request.body);

      try {
        return {
          data: await respondToMemberScheduleAssignment(
            context.schema,
            params.personId,
            params.assignmentId,
            input.status,
          ),
        };
      } catch (error) {
        if (error instanceof MemberScheduleError) {
          return sendMemberScheduleError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/people/:personId/assignments/:assignmentId/replacement-requests",
    async (request, reply) => {
      const params = memberResponseParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = createReplacementRequestSchema.parse(request.body);

      try {
        return {
          data: await createReplacementRequest(
            context.schema,
            params.personId,
            params.assignmentId,
            input,
          ),
        };
      } catch (error) {
        if (error instanceof MemberScheduleError) {
          return sendMemberScheduleError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/replacement-requests/:replacementRequestId/candidates",
    async (request, reply) => {
      const params = replacementRequestParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      const input = inviteReplacementCandidateSchema.parse(request.body);

      try {
        return {
          data: await inviteReplacementCandidate(
            context.schema,
            params.replacementRequestId,
            input.personId,
          ),
        };
      } catch (error) {
        if (error instanceof ReplacementRequestManagerError) {
          return sendReplacementRequestManagerError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post(
    "/tenants/:tenantSlug/replacement-requests/:replacementRequestId/complete",
    async (request, reply) => {
      const params = replacementRequestParamsSchema.parse(request.params);
      const context = await resolveTenantContext(params.tenantSlug, reply);
      if (!context) {
        return;
      }

      try {
        return {
          data: await completeReplacementRequest(
            context.schema,
            params.replacementRequestId,
          ),
        };
      } catch (error) {
        if (error instanceof ReplacementRequestManagerError) {
          return sendReplacementRequestManagerError(error, reply);
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
          data: await listScheduleAssignments(
            context.schema,
            params.scheduleId,
          ),
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

        const notifications =
          input.status === "invited"
            ? await sendScheduleInvitations(
                context.schema,
                context.tenant,
                params.scheduleId,
              )
            : null;

        return reply.code(201).send({
          data: assignment,
          notifications,
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
