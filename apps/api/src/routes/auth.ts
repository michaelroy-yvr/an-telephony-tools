import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db, users, verifyPassword, createSession, deleteSession } from "@an-telephony-tools/core";
import { SESSION_COOKIE } from "../plugins/auth";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function toPublicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { email: string; password: string } }>("/login", async (request, reply) => {
    const { email, password } = request.body;
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const session = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return toPublicUser(user);
  });

  app.post("/logout", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) await deleteSession(sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/me", async (request, reply) => {
    if (!request.currentUser) return reply.code(401).send({ error: "Unauthorized" });
    return toPublicUser(request.currentUser);
  });
};
