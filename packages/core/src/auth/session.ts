import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { sessions, users } from "../db/schema";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function createSession(userId: string) {
  const [session] = await db
    .insert(sessions)
    .values({ userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .returning();
  return session;
}

export async function getSessionUser(sessionId: string) {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));

  if (!row || row.session.expiresAt < new Date()) return null;
  return row.user;
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
