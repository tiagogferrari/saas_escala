import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(12).max(128),
});

export const setupSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(120),
  tenantSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(60),
  tenantDisplayName: z.string().trim().min(2).max(120).optional(),
});

export type SetupInput = z.infer<typeof setupSchema>;
