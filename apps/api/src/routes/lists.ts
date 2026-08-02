import type { FastifyPluginAsync } from "fastify";
import { db, lists, listMemberships } from "@an-telephony-tools/core";
import { requireAuth } from "../plugins/auth";

export const listsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async () => db.select().from(lists));

  app.post<{ Body: { name: string } }>("/", async (request) => {
    const [list] = await db.insert(lists).values({ name: request.body.name }).returning();
    return list;
  });

  app.post<{ Params: { id: string }; Body: { contactIds: string[] } }>(
    "/:id/members",
    async (request) => {
      const { id } = request.params;
      const { contactIds } = request.body;
      if (contactIds.length === 0) return { added: 0 };

      await db
        .insert(listMemberships)
        .values(contactIds.map((contactId) => ({ listId: id, contactId })))
        .onConflictDoNothing();

      return { added: contactIds.length };
    }
  );
};
