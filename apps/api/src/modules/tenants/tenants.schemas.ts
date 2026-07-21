import { z } from "zod";

export const createTenantSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(60),
  displayName: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).default("America/Sao_Paulo"),
  locale: z.string().trim().min(2).default("pt-BR"),
});
