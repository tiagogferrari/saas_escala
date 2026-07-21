import type { FastifyInstance } from "fastify";
import { createSession, revokeSession } from "./auth.repository";
import {
  clearSessionCookie,
  requireManagerSession,
  setSessionCookie,
} from "./auth.context";
import { credentialsSchema, setupSchema } from "./auth.schemas";
import {
  createFirstManager,
  createManagerSession,
  getInitialSetupStatus,
  getManagerProfile,
} from "./auth.service";

const isProduction = process.env.NODE_ENV === "production";

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/setup-status", async () => {
    return {
      data: await getInitialSetupStatus(),
    };
  });

  app.post("/auth/setup", async (request, reply) => {
    const input = setupSchema.parse(request.body);
    const result = await createFirstManager(input);

    if (result.status === "unavailable") {
      return reply.code(409).send({
        error: "initial_setup_unavailable",
        message: "Initial setup has already been completed.",
      });
    }

    if (result.status === "tenant_not_found") {
      return reply.code(404).send({
        error: "tenant_not_found",
        message: "Tenant not found.",
      });
    }

    const session = await createSession(result.user.id);
    setSessionCookie(reply, session.token, session.expiresAt, isProduction);

    return reply.code(201).send({ data: { user: result.user } });
  });

  app.post("/auth/login", async (request, reply) => {
    const input = credentialsSchema.parse(request.body);
    const result = await createManagerSession(input.email, input.password);

    if (!result) {
      return reply.code(401).send({
        error: "invalid_credentials",
        message: "Invalid email or password.",
      });
    }

    const { session, user } = result;
    setSessionCookie(reply, session.token, session.expiresAt, isProduction);

    return {
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
        },
      },
    };
  });

  app.get("/auth/me", async (request, reply) => {
    const user = await requireManagerSession(request, reply);
    if (!user) {
      return;
    }

    return {
      data: await getManagerProfile(user),
    };
  });

  app.post("/auth/logout", async (request, reply) => {
    const cookieHeader = request.headers.cookie ?? "";
    const token = cookieHeader
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith("escala_session="))
      ?.slice("escala_session=".length);

    if (token) {
      await revokeSession(decodeURIComponent(token));
    }

    clearSessionCookie(reply, isProduction);
    return reply.code(204).send();
  });
}
