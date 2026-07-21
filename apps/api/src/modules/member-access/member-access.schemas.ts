import { z } from "zod";

export const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

export const personParamsSchema = tenantParamsSchema.extend({
  personId: z.string().uuid(),
});

export const accessTokenParamsSchema = tenantParamsSchema.extend({
  accessToken: z.string().min(20).max(200),
});

export const accessAssignmentParamsSchema = accessTokenParamsSchema.extend({
  assignmentId: z.string().uuid(),
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
