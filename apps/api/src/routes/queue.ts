import type { FastifyPluginAsync } from "fastify";
import { and, eq } from "drizzle-orm";
import { db, contacts, messages, optOuts, queueAssignments } from "@an-telephony-tools/core";
import { claimNextContact } from "@an-telephony-tools/p2p-texting";
import { requireAuth } from "../plugins/auth";
import { resolveTelephonyProvider } from "../telephony";

export function buildQueueRoutes(fromNumber: string): FastifyPluginAsync {
  return async (app) => {
    app.addHook("preHandler", requireAuth);

    app.post<{ Params: { campaignId: string } }>("/claim", async (request, reply) => {
      const claimed = await claimNextContact(request.params.campaignId, request.currentUser!.id);
      if (!claimed) return reply.code(204).send();

      const [contact] = await db.select().from(contacts).where(eq(contacts.id, claimed.contactId));
      return { assignmentId: claimed.id, contact };
    });

    app.post<{
      Params: { campaignId: string; assignmentId: string };
      Body: { body: string; mediaUrls?: string[] };
    }>("/:assignmentId/send", async (request, reply) => {
      const { campaignId, assignmentId } = request.params;
      const { body, mediaUrls } = request.body;

      const [assignment] = await db
        .select()
        .from(queueAssignments)
        .where(eq(queueAssignments.id, assignmentId));

      if (!assignment || assignment.agentId !== request.currentUser!.id) {
        return reply.code(404).send({ error: "Not found" });
      }

      const [contact] = await db.select().from(contacts).where(eq(contacts.id, assignment.contactId));
      if (!contact) return reply.code(404).send({ error: "Contact not found" });

      const [optOut] = await db
        .select()
        .from(optOuts)
        .where(and(eq(optOuts.phone, contact.phone), eq(optOuts.channel, "sms")));

      if (optOut) {
        await db
          .update(queueAssignments)
          .set({ status: "skipped" })
          .where(eq(queueAssignments.id, assignmentId));
        return reply.code(409).send({ error: "Contact has opted out" });
      }

      const telephony = await resolveTelephonyProvider();
      const result = await telephony.sendSms({ to: contact.phone, from: fromNumber, body, mediaUrls });

      await db.insert(messages).values({
        campaignId,
        contactId: contact.id,
        agentId: request.currentUser!.id,
        direction: "outbound",
        body,
        mediaUrls: mediaUrls ?? [],
        providerMessageId: result.providerMessageId,
        status: result.status,
      });

      await db
        .update(queueAssignments)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(queueAssignments.id, assignmentId));

      return { ok: true };
    });

    app.post<{ Params: { assignmentId: string } }>("/:assignmentId/skip", async (request, reply) => {
      const { assignmentId } = request.params;
      const [assignment] = await db
        .select()
        .from(queueAssignments)
        .where(eq(queueAssignments.id, assignmentId));

      if (!assignment || assignment.agentId !== request.currentUser!.id) {
        return reply.code(404).send({ error: "Not found" });
      }

      await db
        .update(queueAssignments)
        .set({ status: "skipped" })
        .where(eq(queueAssignments.id, assignmentId));

      return { ok: true };
    });
  };
}
