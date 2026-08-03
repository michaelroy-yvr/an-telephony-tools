import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, or } from "drizzle-orm";
import { db, contacts, messages, optOuts, queueAssignments } from "@an-telephony-tools/core";
import { validateTwilioSignature } from "@an-telephony-tools/telephony";

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_KEYWORDS = new Set(["START", "YES", "UNSTOP"]);

interface TwilioInboundBody {
  From?: string;
  Body?: string;
  MessageSid?: string;
}

export const twilioWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/inbound-sms", async (request, reply) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (authToken) {
      const signature = request.headers["x-twilio-signature"];
      const publicUrl = process.env.PUBLIC_API_URL
        ? `${process.env.PUBLIC_API_URL}${request.url}`
        : `${request.protocol}://${request.headers.host}${request.url}`;

      const valid =
        typeof signature === "string" &&
        validateTwilioSignature(authToken, signature, publicUrl, request.body as Record<string, string>);

      if (!valid) {
        request.log.warn("Rejected inbound SMS webhook with invalid Twilio signature");
        return reply.code(403).send({ error: "Invalid signature" });
      }
    } else {
      request.log.warn("TWILIO_AUTH_TOKEN not set — skipping inbound webhook signature validation");
    }

    const { From: from, Body: rawBody, MessageSid: messageSid } = request.body as TwilioInboundBody;

    if (from && rawBody !== undefined) {
      const keyword = rawBody.trim().toUpperCase();

      if (STOP_KEYWORDS.has(keyword)) {
        await db.insert(optOuts).values({ phone: from, channel: "sms", source: "sms_stop" }).onConflictDoNothing();
      } else if (START_KEYWORDS.has(keyword)) {
        await db.delete(optOuts).where(and(eq(optOuts.phone, from), eq(optOuts.channel, "sms")));
      }

      const [contact] = await db.select().from(contacts).where(eq(contacts.phone, from));

      // Associate the reply with whichever campaign/agent most recently texted this
      // contact, so it lands in that agent's context — not a guess, since P2P
      // texting is inherently conversational and replies only make sense in
      // reference to the message that prompted them.
      let campaignId: string | null = null;
      let agentId: string | null = null;
      if (contact) {
        const [lastAssignment] = await db
          .select()
          .from(queueAssignments)
          .where(
            and(
              eq(queueAssignments.contactId, contact.id),
              or(eq(queueAssignments.status, "sent"), eq(queueAssignments.status, "replied"))
            )
          )
          .orderBy(desc(queueAssignments.sentAt))
          .limit(1);

        if (lastAssignment) {
          campaignId = lastAssignment.campaignId;
          agentId = lastAssignment.agentId;

          await db
            .update(queueAssignments)
            .set({ status: "replied" })
            .where(eq(queueAssignments.id, lastAssignment.id));
        }
      }

      await db.insert(messages).values({
        campaignId,
        contactId: contact?.id ?? null,
        agentId,
        direction: "inbound",
        body: rawBody,
        providerMessageId: messageSid,
        status: "received",
      });
    }

    reply.type("text/xml").send("<Response></Response>");
  });
};
