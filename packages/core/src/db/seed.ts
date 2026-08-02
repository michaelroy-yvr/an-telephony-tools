import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";
import { hashPassword } from "../auth/password";

const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.ADMIN_PASSWORD ?? "changeme123";
const name = process.env.ADMIN_NAME ?? "Admin";

const [existing] = await db.select().from(users).where(eq(users.email, email));

if (existing) {
  console.log(`Admin user already exists: ${email}`);
} else {
  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ email, passwordHash, name, role: "admin" });
  console.log(`Created admin user: ${email} / ${password}`);
  console.log("Set ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME env vars to override.");
}

process.exit(0);
