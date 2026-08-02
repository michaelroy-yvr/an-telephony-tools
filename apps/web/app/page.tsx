"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, type User } from "../lib/api";

export default function HomePage() {
  const [user, setUser] = useState<User | null | "loading">("loading");

  useEffect(() => {
    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>an-telephony-tools</h1>
      <p>P2P texting MVP.</p>

      {user === "loading" ? (
        <p>Loading…</p>
      ) : user ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-start" }}>
          <p>
            Signed in as {user.name} ({user.role})
          </p>
          <Link href="/campaigns">Go to campaigns</Link>
          <button onClick={handleLogout} style={{ padding: "0.5rem" }}>
            Log out
          </button>
        </div>
      ) : (
        <Link href="/login">Log in</Link>
      )}
    </main>
  );
}
