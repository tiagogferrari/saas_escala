import { z } from "zod";

const occurrenceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

export const scheduleParamsSchema = tenantParamsSchema.extend({
  scheduleId: z.string().uuid(),
});

export const scheduleSeriesParamsSchema = tenantParamsSchema.extend({
  seriesId: z.string().uuid(),
});

export const scheduleSeriesOccurrenceParamsSchema =
  scheduleSeriesParamsSchema.extend({
    occurrenceDate: occurrenceDateSchema,
  });

export const assignmentInvitationParamsSchema = scheduleParamsSchema.extend({
  assignmentId: z.string().uuid(),
});

export const memberParamsSchema = tenantParamsSchema.extend({
  personId: z.string().uuid(),
});

export const memberResponseParamsSchema = memberParamsSchema.extend({
  assignmentId: z.string().uuid(),
});

export const replacementRequestParamsSchema = tenantParamsSchema.extend({
  replacementRequestId: z.string().uuid(),
});

const optionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value === "" ? null : value));

export const createScheduleSchema = z
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

export const createScheduleSeriesSchema = z
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

export const updateScheduleSeriesOccurrenceSchema = z.object({
  skipped: z.boolean(),
  note: optionalTextSchema,
});

export const updateScheduleSeriesOccurrenceDetailsSchema = z
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

export const updateScheduleSeriesSchema = z
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

export const cancelScheduleSeriesSchema = z.object({
  cancelFrom: occurrenceDateSchema,
  note: optionalTextSchema,
});

export const cancelScheduleSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});

export const createAssignmentSchema = z.object({
  personId: z.string().uuid(),
  status: z
    .enum(["invited", "externally_confirmed"])
    .default("externally_confirmed"),
});

export const respondAssignmentSchema = z.object({
  status: z.enum(["confirmed", "declined"]),
});

export const createReplacementRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
  urgent: z.boolean().optional().default(false),
});

export const inviteReplacementCandidateSchema = z.object({
  personId: z.string().uuid(),
});
