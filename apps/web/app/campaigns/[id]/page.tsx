"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError, type CampaignDetail } from "../../../lib/api";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function load() {
    const [campaignData, statsData] = await Promise.all([
      apiFetch<CampaignDetail>(`/campaigns/${id}`),
      apiFetch<Record<string, number>>(`/campaigns/${id}/stats`),
    ]);
    setCampaign(campaignData);
    setStats(statsData);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load campaign"));
  }, [id]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await apiFetch(`/campaigns/${id}/start`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start campaign");
    } finally {
      setStarting(false);
    }
  }

  if (error) return <p style={{ padding: "2rem", color: "crimson" }}>{error}</p>;
  if (!campaign) return <p style={{ padding: "2rem" }}>Loading…</p>;

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 640 }}>
      <p>
        <Link href="/campaigns">← Campaigns</Link>
      </p>
      <h1>{campaign.name}</h1>
      <p>Status: {campaign.status}</p>

      {stats && (
        <ul>
          {Object.entries(stats).map(([status, count]) => (
            <li key={status}>
              {status}: {count}
            </li>
          ))}
        </ul>
      )}

      <h2>Templates</h2>
      <ul>
        {campaign.templates.map((t) => (
          <li key={t.id}>
            <strong>{t.label}:</strong> {t.body}
          </li>
        ))}
      </ul>

      {campaign.status === "draft" ? (
        <button onClick={handleStart} disabled={starting} style={{ padding: "0.5rem" }}>
          {starting ? "Starting…" : "Start campaign"}
        </button>
      ) : (
        <Link href={`/queue/${campaign.id}`}>
          <button style={{ padding: "0.5rem" }}>Work the queue</button>
        </Link>
      )}
    </main>
  );
}
