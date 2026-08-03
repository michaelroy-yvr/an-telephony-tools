"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, type SmsMode } from "../lib/api";

const POLL_INTERVAL_MS = 10_000;

export function SmsModeBadge() {
  const [mode, setMode] = useState<SmsMode | null>(null);

  useEffect(() => {
    let cancelled = false;

    function refresh() {
      apiFetch<{ smsMode: SmsMode }>("/settings")
        .then((res) => {
          if (!cancelled) setMode(res.smsMode);
        })
        .catch(() => {
          // Settings is unauthenticated-safe and should always respond; if it
          // doesn't, leave the last-known mode showing rather than hide the badge.
        });
    }

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!mode) return null;

  const isLive = mode === "live";

  return (
    <Link
      href="/settings"
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 1000,
        padding: "0.4rem 0.75rem",
        borderRadius: "4px",
        fontFamily: "sans-serif",
        fontSize: "0.85rem",
        fontWeight: "bold",
        textDecoration: "none",
        color: isLive ? "#fff" : "#333",
        background: isLive ? "crimson" : "#ddd",
        border: isLive ? "1px solid darkred" : "1px solid #bbb",
      }}
    >
      {isLive ? "⚠ LIVE — real texts send" : "MOCK — texts are logged only"}
    </Link>
  );
}
