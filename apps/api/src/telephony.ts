import { eq, sql } from "drizzle-orm";
import { db, appSettings } from "@an-telephony-tools/core";
import { TwilioProvider, MockProvider, type TelephonyProvider } from "@an-telephony-tools/telephony";

const SETTINGS_ID = "singleton";

const mockProvider = new MockProvider();
let twilioProvider: TwilioProvider | null = null;

// Constructed lazily (not at boot) so a deploy with no Twilio credentials configured
// can still run in mock mode indefinitely — the error only surfaces if something
// actually tries to go live.
function getTwilioProvider(): TwilioProvider {
  if (!twilioProvider) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not configured");
    }
    twilioProvider = new TwilioProvider(accountSid, authToken);
  }
  return twilioProvider;
}

async function ensureSettingsRow() {
  await db.insert(appSettings).values({ id: SETTINGS_ID }).onConflictDoNothing();
}

export async function getSmsMode(): Promise<"mock" | "live"> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID));
  return row?.smsMode ?? "mock";
}

// Re-validates Twilio credentials on every switch to live, not just at boot, so a
// misconfigured or since-revoked credential can never leave the app stuck in a
// live mode it can't actually honor safely.
export async function setSmsMode(mode: "mock" | "live"): Promise<void> {
  if (mode === "live") {
    getTwilioProvider();
  }
  await ensureSettingsRow();
  await db
    .update(appSettings)
    .set({ smsMode: mode, updatedAt: sql`now()` })
    .where(eq(appSettings.id, SETTINGS_ID));
}

// Re-checked on every send rather than cached — the whole point of the switch is
// that flipping it takes effect immediately for every agent already mid-queue.
export async function resolveTelephonyProvider(): Promise<TelephonyProvider> {
  const mode = await getSmsMode();
  return mode === "live" ? getTwilioProvider() : mockProvider;
}
