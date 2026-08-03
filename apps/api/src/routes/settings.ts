import type { FastifyPluginAsync } from "fastify";
import { getSmsMode, setSmsMode } from "../telephony";
import { requireRole } from "../plugins/auth";

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  // Deliberately not behind requireAuth: the mode isn't sensitive, and the agent
  // UI needs to show it even on the login screen so nobody can miss it.
  app.get("/", async () => ({ smsMode: await getSmsMode() }));

  app.post<{ Body: { mode: "mock" | "live" } }>(
    "/sms-mode",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      try {
        await setSmsMode(request.body.mode);
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : "Failed to switch SMS mode",
        });
      }
      return { smsMode: await getSmsMode() };
    }
  );
};
