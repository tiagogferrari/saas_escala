import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveTenantContext } from "../tenant-context/tenant-context";
import {
  createScheduleFunction,
  listScheduleFunctions,
} from "./function-repository";

const tenantParamsSchema = z.object({
  tenantSlug: z.string().min(1),
});

const createFunctionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z
    .string()
    .trim()
    .max(240)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function scheduleFunctionRoutes(app: FastifyInstance) {
  app.get("/tenants/:tenantSlug/functions", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    return {
      data: await listScheduleFunctions(context.schema),
    };
  });

  app.post("/tenants/:tenantSlug/functions", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const context = await resolveTenantContext(params.tenantSlug, reply);
    if (!context) {
      return;
    }

    const input = createFunctionSchema.parse(request.body);

    try {
      const scheduleFunction = await createScheduleFunction(
        context.schema,
        input,
      );

      return reply.code(201).send({
        data: scheduleFunction,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({
          error: "function_already_exists",
          message: "Function already exists for this tenant.",
        });
      }

      throw error;
    }
  });
}
