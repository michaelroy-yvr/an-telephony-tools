import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db, appSettings } from "@an-telephony-tools/core";
import { ActionNetworkClient, runSync } from "@an-telephony-tools/action-network";
import { requireAuth, requireRole } from "../plugins/auth";

export const actionNetworkRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/status", async () => {
    const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, "singleton"));
    return {
      configured: Boolean(process.env.ACTION_NETWORK_API_KEY),
      lastSyncedAt: settings?.actionNetworkLastSyncedAt ?? null,
    };
  });

  app.post("/sync", { preHandler: requireRole("admin") }, async (request, reply) => {
    const apiKey = process.env.ACTION_NETWORK_API_KEY;
    if (!apiKey) {
      return reply.code(400).send({ error: "ACTION_NETWORK_API_KEY is not configured" });
    }

    const client = new ActionNetworkClient(apiKey);
    const result = await runSync(client);
    return result;
  });
};
