import type { ActionNetworkClient, ActionNetworkPerson } from "./client";

export interface FieldMapping {
  actionNetworkPath: string;
  contactField: string;
}

export function extractPhone(person: ActionNetworkPerson): string | undefined {
  return person.phone_numbers?.find((p) => p.primary)?.number ?? person.phone_numbers?.[0]?.number;
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
