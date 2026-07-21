import { z } from "zod";

export const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

export const createPersonSchema = z.object({
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
