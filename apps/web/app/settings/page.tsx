"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError, type ActionNetworkStatus, type SmsMode, type User } from "../../lib/api";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [smsMode, setSmsModeState] = useState<SmsMode | null>(null);
  const [anStatus, setAnStatus] = useState<ActionNetworkStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  function load() {
    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
    apiFetch<{ smsMode: SmsMode }>("/settings").then((res) => setSmsModeState(res.smsMode));
    apiFetch<ActionNetworkStatus>("/integrations/action-network/status")
      .then(setAnStatus)
      .catch(() => setAnStatus(null));
  }

  useEffect(load, []);

  async function handleSwitchMode(next: SmsMode) {
    const confirmed =
      next === "live"
        ? window.confirm(
            "Switch to LIVE mode? Agents will start sending REAL text messages to real phone numbers immediately."
          )
        : window.confirm("Switch to MOCK mode? Sends will only be logged, not delivered.");
    if (!confirmed) return;

    setSwitching(true);
    setError(null);
    try {
      const res = await apiFetch<{ smsMode: SmsMode }>("/settings/sms-mode", {
        method: "POST",
        body: JSON.stringify({ mode: next }),
      });
      setSmsModeState(res.smsMode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to switch mode");
    } finally {
      setSwitching(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await apiFetch<{ total: number; upserted: number; skippedNoPhone: number }>(
        "/integrations/action-network/sync",
        { method: "POST" }
      );
      setSyncMessage(
        `Synced ${result.upserted}/${result.total} people (${result.skippedNoPhone} skipped, no phone).`
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const isAdmin = user !== "loading" && user !== null && user.role === "admin";

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 560 }}>
      <p>
        <Link href="/">← Home</Link>
      </p>
      <h1>Settings</h1>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <h2>SMS send mode</h2>
      <p>
        Current mode:{" "}
        <strong style={{ color: smsMode === "live" ? "crimson" : "inherit" }}>
          {smsMode === "live" ? "LIVE — real texts send" : smsMode === "mock" ? "MOCK — logged only" : "…"}
        </strong>
      </p>
      {isAdmin ? (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <button
            onClick={() => handleSwitchMode("mock")}
            disabled={switching || smsMode === "mock"}
            style={{ padding: "0.5rem 1rem" }}
          >
            Switch to mock
          </button>
          <button
            onClick={() => handleSwitchMode("live")}
            disabled={switching || smsMode === "live"}
            style={{ padding: "0.5rem 1rem", color: "crimson" }}
          >
            Switch to live
          </button>
        </div>
      ) : (
        <p style={{ color: "#666" }}>Only admins can change the send mode.</p>
      )}

      <h2>Action Network sync</h2>
      {anStatus ? (
        <>
          <p>Configured: {anStatus.configured ? "yes" : "no (set ACTION_NETWORK_API_KEY)"}</p>
          <p>Last synced: {anStatus.lastSyncedAt ? new Date(anStatus.lastSyncedAt).toLocaleString() : "never"}</p>
        </>
      ) : (
        <p>Loading…</p>
      )}
      {isAdmin && (
        <button
          onClick={handleSync}
          disabled={syncing || !anStatus?.configured}
          style={{ padding: "0.5rem 1rem" }}
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      )}
      {syncMessage && <p>{syncMessage}</p>}
    </main>
  );
}
