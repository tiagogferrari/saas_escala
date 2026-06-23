import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import { z, ZodError } from "zod";
import "./config/load-env";
import {
  requireManagerSession,
  requireTenantManagementAccess,
} from "./auth/auth-context";
import { authRoutes } from "./auth/auth-routes";
import { checkDatabase } from "./db/pool";
import { locationRoutes } from "./locations/location-routes";
import { memberAccessRoutes } from "./member-access/member-access-routes";
import { startNotificationScheduler } from "./notifications/notification-scheduler";
import { peopleRoutes } from "./people/people-routes";
import { scheduleFunctionRoutes } from "./schedule-functions/function-routes";
import { scheduleRoutes } from "./schedules/schedule-routes";
import { tenantRoutes } from "./tenants/tenant-routes";

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3333),
  NODE_ENV: z.string().default("development"),
});

const env = envSchema.parse(process.env);

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
  },
});

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(helmet);
app.decorateRequest("managerAuth", null);

app.addHook("preHandler", async (request, reply) => {
  const pathname = (request.raw.url ?? "").split("?")[0] ?? "";
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/health") ||
    pathname.startsWith("/auth/") ||
    /^\/tenants\/[^/]+\/member-access\/[^/]+\/(schedules|assignments\/[^/]+\/(respond|replacement-requests))$/.test(
      pathname,
    );

  if (isPublicRoute || !pathname.startsWith("/tenants")) {
    return;
  }

  const user = await requireManagerSession(request, reply);
  if (!user) {
    return reply;
  }

  const tenantSlug = pathname.match(/^\/tenants\/([^/]+)/)?.[1];
  if (!tenantSlug) {
    return;
  }

  const allowed = await requireTenantManagementAccess(
    user,
    decodeURIComponent(tenantSlug),
    reply,
  );
  if (!allowed) {
    return reply;
  }
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "validation_error",
      issues: error.issues,
    });
  }

  return reply.send(error);
});

app.get("/health", async () => ({
  status: "ok",
  service: "escala-api",
  timestamp: new Date().toISOString(),
}));

app.get("/health/db", async () => ({
  status: (await checkDatabase()) ? "ok" : "error",
  service: "postgres",
  timestamp: new Date().toISOString(),
}));

app.get("/", async () => ({
  name: "SaaS Escala API",
  status: "running",
}));

await app.register(tenantRoutes);
await app.register(authRoutes);
await app.register(peopleRoutes);
await app.register(locationRoutes);
await app.register(scheduleFunctionRoutes);
await app.register(scheduleRoutes);
await app.register(memberAccessRoutes);
startNotificationScheduler(app);

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
