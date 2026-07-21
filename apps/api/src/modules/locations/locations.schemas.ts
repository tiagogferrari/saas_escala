import { z } from "zod";

export const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(140),
  address: z
    .string()
    .trim()
    .max(240)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
  timezone: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});
