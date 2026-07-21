import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedUser } from "./auth-repository";
import { getUserBySessionToken, userCanManageTenant } from "./auth-repository";

declare module "fastify" {
  interface FastifyRequest {
    managerAuth: AuthenticatedUser | null;
  }
}

const sessionCookieName = "escala_session";

function readCookie(request: FastifyRequest, name: string) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${name}=`;
  const item = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  if (!item) {
    return null;
  }

  return decodeURIComponent(item.slice(prefix.length));
}

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
  isProduction: boolean,
) {
  const attributes = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))}`,
  ];

  if (isProduction) {
    attributes.push("Secure");
  }

  reply.header("set-cookie", attributes.join("; "));
}

export function clearSessionCookie(reply: FastifyReply, isProduction: boolean) {
  const attributes = [
    `${sessionCookieName}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (isProduction) {
    attributes.push("Secure");
  }

  reply.header("set-cookie", attributes.join("; "));
}

export async function requireManagerSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = readCookie(request, sessionCookieName);
  if (!token) {
    reply.code(401).send({
      error: "authentication_required",
      message: "Manager authentication is required.",
    });
    return null;
  }

  const user = await getUserBySessionToken(token);
  if (!user) {
    reply.code(401).send({
      error: "session_invalid",
      message: "Manager session is invalid or expired.",
    });
    return null;
  }

  request.managerAuth = user;
  return user;
}

export async function requireTenantManagementAccess(
  user: AuthenticatedUser,
  tenantSlug: string,
  reply: FastifyReply,
) {
  const allowed = await userCanManageTenant(user.id, tenantSlug);
  if (!allowed) {
    reply.code(403).send({
      error: "tenant_access_denied",
      message: "Manager does not have access to this tenant.",
    });
    return false;
  }

  return true;
}
