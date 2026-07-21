import { z } from "zod";

export const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

export const createFunctionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z
    .string()
    .trim()
    .max(240)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});
