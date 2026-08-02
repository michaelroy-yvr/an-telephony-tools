import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { TwilioProvider, MockProvider } from "@an-telephony-tools/telephony";
import authPlugin from "./plugins/auth";
import { authRoutes } from "./routes/auth";
import { contactsRoutes } from "./routes/contacts";
import { listsRoutes } from "./routes/lists";
import { campaignsRoutes } from "./routes/campaigns";
import { buildQueueRoutes } from "./routes/queue";
import { twilioWebhookRoutes } from "./routes/webhooks/twilio";

const app = Fastify({ logger: true });

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

await app.register(cors, { origin: webOrigin, credentials: true });
await app.register(cookie);
await app.register(authPlugin);

const telephony =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? new TwilioProvider(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : new MockProvider();

if (telephony instanceof MockProvider) {
  app.log.warn(
    "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set — using MockProvider (SMS sends are logged, not delivered)"
  );
}

const fromNumber = process.env.TWILIO_SMS_FROM_NUMBER ?? "+10000000000";

app.get("/health", async () => ({ status: "ok" }));

app.register(authRoutes, { prefix: "/auth" });
app.register(contactsRoutes, { prefix: "/contacts" });
app.register(listsRoutes, { prefix: "/lists" });
app.register(campaignsRoutes, { prefix: "/campaigns" });
app.register(buildQueueRoutes(telephony, fromNumber), { prefix: "/campaigns/:campaignId/queue" });
app.register(twilioWebhookRoutes, { prefix: "/webhooks/twilio" });

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
