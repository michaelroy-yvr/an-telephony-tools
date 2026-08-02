import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { db, contacts } from "@an-telephony-tools/core";
import { requireAuth } from "../plugins/auth";

interface ContactInput {
  phone: string;
  firstName?: string;
  lastName?: string;
}

export const contactsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async () => db.select().from(contacts));

  // Upserts by phone (the unique key) so re-submitting the same list doesn't
  // create duplicate contacts, and always returns ids for the caller to use.
  app.post<{ Body: { contacts: ContactInput[] } }>("/bulk", async (request) => {
    const input = request.body.contacts;
    if (input.length === 0) return { contacts: [] };

    const rows = await db
      .insert(contacts)
      .values(
        input.map((c) => ({
          phone: c.phone,
          firstName: c.firstName,
          lastName: c.lastName,
          source: "manual" as const,
        }))
      )
      .onConflictDoUpdate({
        target: contacts.phone,
        set: { updatedAt: sql`now()` },
      })
      .returning();

    return { contacts: rows };
  });
};
