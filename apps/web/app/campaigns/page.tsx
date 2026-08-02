"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError, type Campaign, type Contact } from "../../lib/api";

function parseContactLines(text: string): Array<{ phone: string; firstName?: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [phone, firstName] = line.split(",").map((part) => part.trim());
      return firstName ? { phone, firstName } : { phone };
    });
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [listName, setListName] = useState("");
  const [contactsText, setContactsText] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<Campaign[]>("/campaigns").then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const list = await apiFetch<{ id: string }>("/lists", {
        method: "POST",
        body: JSON.stringify({ name: listName }),
      });

      const contactInputs = parseContactLines(contactsText);
      const { contacts } = await apiFetch<{ contacts: Contact[] }>("/contacts/bulk", {
        method: "POST",
        body: JSON.stringify({ contacts: contactInputs }),
      });

      await apiFetch(`/lists/${list.id}/members`, {
        method: "POST",
        body: JSON.stringify({ contactIds: contacts.map((c) => c.id) }),
      });

      const campaign = await apiFetch<Campaign>("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: campaignName,
          listId: list.id,
          templates: templateBody ? [{ label: "Default", body: templateBody }] : [],
        }),
      });

      setCampaigns((prev) => [...(prev ?? []), campaign]);
      setListName("");
      setContactsText("");
      setCampaignName("");
      setTemplateBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>Campaigns</h1>

      {campaigns === null ? (
        <p>Loading…</p>
      ) : campaigns.length === 0 ? (
        <p>No campaigns yet.</p>
      ) : (
        <ul>
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/campaigns/${c.id}`}>{c.name}</Link> — {c.status}
            </li>
          ))}
        </ul>
      )}

      <h2>New campaign</h2>
      <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Campaign name
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          List name
          <input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          Contacts (one per line: <code>phone,firstName</code>)
          <textarea
            value={contactsText}
            onChange={(e) => setContactsText(e.target.value)}
            rows={5}
            placeholder="+16045551234,Alex"
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          Default message template
          <textarea
            value={templateBody}
            onChange={(e) => setTemplateBody(e.target.value)}
            rows={3}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: "0.5rem" }}>
          {submitting ? "Creating…" : "Create campaign"}
        </button>
      </form>
    </main>
  );
}
