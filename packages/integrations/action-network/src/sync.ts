import { eq, sql } from "drizzle-orm";
import { db, contacts, appSettings } from "@an-telephony-tools/core";
import type { ActionNetworkClient, ActionNetworkPerson } from "./client";

const SETTINGS_ID = "singleton";

export interface FieldMapping {
  actionNetworkPath: string;
  contactField: string;
}

export function extractPhone(person: ActionNetworkPerson): string | undefined {
  return person.phone_numbers?.find((p) => p.primary)?.number ?? person.phone_numbers?.[0]?.number;
}

export function extractActionNetworkId(person: ActionNetworkPerson): string | undefined {
  return person.identifiers?.find((id) => id.startsWith("action_network:"))?.split(":")[1];
}

export async function pullModifiedSince(client: ActionNetworkClient, since: Date) {
  const people: ActionNetworkPerson[] = [];
  let page = 1;

  // Action Network paginates /people; walk pages until one comes back short of a full page.
  while (true) {
    const result = await client.getPeople({ modifiedSince: since, page });
    const batch = result._embedded["osdi:people"];
    people.push(...batch);
    if (batch.length === 0) break;
    page += 1;
  }

  return people;
}

export interface SyncResult {
  total: number;
  upserted: number;
  skippedNoPhone: number;
  syncedAt: Date;
}

// Custom fields are carried through as-is rather than mapped to specific columns —
// every org's Action Network instance has different fields, and building a
// configurable mapping UI is future work (see ARCHITECTURE.md roadmap).
export async function runSync(client: ActionNetworkClient): Promise<SyncResult> {
  const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID));
  const since = settings?.actionNetworkLastSyncedAt ?? new Date(0);

  const people = await pullModifiedSince(client, since);

  let upserted = 0;
  let skippedNoPhone = 0;

  for (const person of people) {
    const phone = extractPhone(person);
    if (!phone) {
      skippedNoPhone += 1;
      continue;
    }

    await db
      .insert(contacts)
      .values({
        phone,
        firstName: person.given_name,
        lastName: person.family_name,
        customFields: person.custom_fields ?? {},
        source: "action_network",
        actionNetworkId: extractActionNetworkId(person),
      })
      .onConflictDoUpdate({
        target: contacts.phone,
        set: {
          firstName: person.given_name,
          lastName: person.family_name,
          customFields: person.custom_fields ?? {},
          actionNetworkId: extractActionNetworkId(person),
          updatedAt: sql`now()`,
        },
      });

    upserted += 1;
  }

  const syncedAt = new Date();
  await db
    .insert(appSettings)
    .values({ id: SETTINGS_ID, actionNetworkLastSyncedAt: syncedAt })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { actionNetworkLastSyncedAt: syncedAt, updatedAt: sql`now()` },
    });

  return { total: people.length, upserted, skippedNoPhone, syncedAt };
}
