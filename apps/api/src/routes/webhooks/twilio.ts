import type { FastifyPluginAsync } from "fastify";

export const twilioWebhookRoutes: FastifyPluginAsync = async (app) => {
  // TODO: verify the Twilio request signature before trusting this payload.
  app.post("/inbound-sms", async (request, reply) => {
    const body = request.body as { Body?: string; From?: string };
    const text = body.Body?.trim().toUpperCase();

    if (text === "STOP" || text === "START") {
      // TODO: write to opt_outs (STOP) / remove opt-out (START) for body.From.
    }

    reply.type("text/xml").send("<Response></Response>");
  });
};
