"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError, type CampaignDetail, type Contact } from "../../../lib/api";

interface ClaimResult {
  assignmentId: string;
  contact: Contact;
}

const SEGMENT_LIMIT_GSM7 = 136;

export default function QueuePage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [current, setCurrent] = useState<ClaimResult | null | "empty">(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "claiming" | "sending" | "skipping">("idle");

  const claimNext = useCallback(async () => {
    setStatus("claiming");
    setError(null);
    try {
      const claimed = await apiFetch<ClaimResult | undefined>(`/campaigns/${campaignId}/queue/claim`, {
        method: "POST",
      });
      if (!claimed) {
        setCurrent("empty");
      } else {
        setCurrent(claimed);
        setBody(campaign?.templates[0]?.body ?? "");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to claim next contact");
    } finally {
      setStatus("idle");
    }
  }, [campaignId, campaign]);

  useEffect(() => {
    apiFetch<CampaignDetail>(`/campaigns/${campaignId}`)
      .then(setCampaign)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load campaign"));
  }, [campaignId]);

  // Guards against React Strict Mode's double effect invocation in dev, which would
  // otherwise silently claim two assignments and strand one in "assigned" limbo.
  const hasClaimedRef = useRef(false);
  useEffect(() => {
    if (campaign && !hasClaimedRef.current) {
      hasClaimedRef.current = true;
      claimNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign]);

  async function handleSend() {
    if (!current || current === "empty") return;
    setStatus("sending");
    setError(null);
    try {
      await apiFetch(`/campaigns/${campaignId}/queue/${current.assignmentId}/send`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      await claimNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
      setStatus("idle");
    }
  }

  async function handleSkip() {
    if (!current || current === "empty") return;
    setStatus("skipping");
    setError(null);
    try {
      await apiFetch(`/campaigns/${campaignId}/queue/${current.assignmentId}/skip`, { method: "POST" });
      await claimNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to skip contact");
      setStatus("idle");
    }
  }

  if (!campaign) return <p style={{ padding: "2rem" }}>Loading…</p>;

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 480 }}>
      <p>
        <Link href={`/campaigns/${campaignId}`}>← {campaign.name}</Link>
      </p>
      <h1>Agent queue</h1>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {current === "empty" ? (
        <p>No more contacts in the queue.</p>
      ) : current ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <strong>{current.contact.firstName ?? "Contact"}</strong>
            <div>{current.contact.phone}</div>
          </div>

          {campaign.templates.length > 0 && (
            <label>
              Template
              <select
                onChange={(e) => setBody(campaign.templates.find((t) => t.id === e.target.value)?.body ?? "")}
                defaultValue=""
                style={{ display: "block", width: "100%", padding: "0.5rem" }}
              >
                <option value="" disabled>
                  Choose a template…
                </option>
                {campaign.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </label>
          <div style={{ fontSize: "0.85rem", color: body.length > SEGMENT_LIMIT_GSM7 ? "crimson" : "#666" }}>
            {body.length} / {SEGMENT_LIMIT_GSM7} chars (single GSM-7 segment)
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleSend} disabled={status !== "idle" || !body} style={{ padding: "0.5rem 1rem" }}>
              {status === "sending" ? "Sending…" : "Send"}
            </button>
            <button onClick={handleSkip} disabled={status !== "idle"} style={{ padding: "0.5rem 1rem" }}>
              {status === "skipping" ? "Skipping…" : "Skip"}
            </button>
          </div>
        </div>
      ) : (
        <p>Claiming next contact…</p>
      )}
    </main>
  );
}
