import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { getSessionUser } from "@an-telephony-tools/core";

export const SESSION_COOKIE = "session";

type CurrentUser = Awaited<ReturnType<typeof getSessionUser>>;

declare module "fastify" {
  interface FastifyRequest {
    currentUser: CurrentUser;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("currentUser", null);

  app.addHook("preHandler", async (request) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) return;
    request.currentUser = await getSessionUser(sessionId);
  });
};

export default fp(authPlugin);

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.currentUser) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: Array<"admin" | "campaign_manager" | "agent">) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    if (!roles.includes(request.currentUser.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}
