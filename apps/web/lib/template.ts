import type { Contact } from "./api";

export function renderTemplate(body: string, contact: Contact): string {
  return body
    .replaceAll("{firstName}", contact.firstName ?? "")
    .replaceAll("{lastName}", contact.lastName ?? "")
    .replaceAll("{phone}", contact.phone);
}
