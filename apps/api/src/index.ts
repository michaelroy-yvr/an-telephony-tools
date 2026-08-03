try {
  process.loadEnvFile();
} catch {
  // .env is optional in prod, where real env vars are usually injected directly
}

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import authPlugin from "./plugins/auth";
import { authRoutes } from "./routes/auth";
import { contactsRoutes } from "./routes/contacts";
import { listsRoutes } from "./routes/lists";
import { campaignsRoutes } from "./routes/campaigns";
import { buildQueueRoutes } from "./routes/queue";
import { settingsRoutes } from "./routes/settings";
import { actionNetworkRoutes } from "./routes/action-network";
import { twilioWebhookRoutes } from "./routes/webhooks/twilio";
import { registerActionNetworkSync } from "./jobs/action-network-sync";

const app = Fastify({ logger: true });

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

await app.register(cors, { origin: webOrigin, credentials: true });
await app.register(cookie);
await app.register(formbody);
await app.register(authPlugin);

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  app.log.warn(
    "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set — live mode will be unavailable (mock-only)"
  );
}

const fromNumber = process.env.TWILIO_SMS_FROM_NUMBER ?? "+10000000000";

registerActionNetworkSync(app);

app.get("/health", async () => ({ status: "ok" }));

app.register(authRoutes, { prefix: "/auth" });
app.register(contactsRoutes, { prefix: "/contacts" });
app.register(listsRoutes, { prefix: "/lists" });
app.register(campaignsRoutes, { prefix: "/campaigns" });
app.register(buildQueueRoutes(fromNumber), { prefix: "/campaigns/:campaignId/queue" });
app.register(settingsRoutes, { prefix: "/settings" });
app.register(actionNetworkRoutes, { prefix: "/integrations/action-network" });
app.register(twilioWebhookRoutes, { prefix: "/webhooks/twilio" });

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
