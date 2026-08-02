"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      router.push("/campaigns");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 360 }}>
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: "0.5rem" }}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
