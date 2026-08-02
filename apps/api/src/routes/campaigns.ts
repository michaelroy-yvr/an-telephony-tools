import type { FastifyPluginAsync } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db, campaigns, messageTemplates, queueAssignments } from "@an-telephony-tools/core";
import { requireAuth, requireRole } from "../plugins/auth";

export const campaignsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async () => db.select().from(campaigns));

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, request.params.id));
    if (!campaign) return reply.code(404).send({ error: "Not found" });

    const templates = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.campaignId, campaign.id));

    return { ...campaign, templates };
  });

  app.get<{ Params: { id: string } }>("/:id/stats", async (request) => {
    const rows = await db
      .select({ status: queueAssignments.status, count: sql<number>`count(*)::int` })
      .from(queueAssignments)
      .where(eq(queueAssignments.campaignId, request.params.id))
      .groupBy(queueAssignments.status);

    return Object.fromEntries(rows.map((r) => [r.status, r.count]));
  });

  app.post<{
    Body: { name: string; listId: string; templates: Array<{ label: string; body: string }> };
  }>("/", { preHandler: requireRole("admin", "campaign_manager") }, async (request) => {
    const { name, listId, templates } = request.body;

    const [campaign] = await db
      .insert(campaigns)
      .values({ name, listId, createdBy: request.currentUser!.id })
      .returning();

    if (templates.length > 0) {
      await db
        .insert(messageTemplates)
        .values(templates.map((t) => ({ campaignId: campaign.id, label: t.label, body: t.body })));
    }

    return campaign;
  });

  app.post<{ Params: { id: string } }>(
    "/:id/start",
    { preHandler: requireRole("admin", "campaign_manager") },
    async (request, reply) => {
      const { id } = request.params;
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
      if (!campaign) return reply.code(404).send({ error: "Not found" });

      // Opt-outs are checked once here, at queue build time, rather than per-send,
      // so agents never even see a contact who can't legally be texted.
      await db.execute(sql`
        INSERT INTO queue_assignments (campaign_id, contact_id, status)
        SELECT ${id}, lm.contact_id, 'pending'
        FROM list_memberships lm
        JOIN contacts c ON c.id = lm.contact_id
        WHERE lm.list_id = ${campaign.listId}
          AND NOT EXISTS (
            SELECT 1 FROM opt_outs o WHERE o.phone = c.phone AND o.channel = 'sms'
          )
        ON CONFLICT (campaign_id, contact_id) DO NOTHING
      `);

      const [updated] = await db
        .update(campaigns)
        .set({ status: "active" })
        .where(eq(campaigns.id, id))
        .returning();

      return updated;
    }
  );
};
