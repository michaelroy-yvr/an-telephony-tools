import { sql } from "drizzle-orm";
import { db, queueAssignments } from "@an-telephony-tools/core";

export interface ClaimedAssignment {
  id: string;
  contactId: string;
}

const STALE_CLAIM_MINUTES = 15;

// FOR UPDATE SKIP LOCKED is what guarantees two agents never get handed the same
// contact even when they claim concurrently. Assignments "assigned" longer than
// STALE_CLAIM_MINUTES ago (agent closed the tab, crashed, etc. without sending or
// skipping) are eligible again so they don't get stranded forever — pending
// contacts are still preferred via the ORDER BY.
export async function claimNextContact(
  campaignId: string,
  agentId: string
): Promise<ClaimedAssignment | null> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; contact_id: string }>(sql`
      SELECT id, contact_id FROM queue_assignments
      WHERE campaign_id = ${campaignId}
        AND (
          status = 'pending'
          OR (status = 'assigned' AND assigned_at < now() - interval '${sql.raw(String(STALE_CLAIM_MINUTES))} minutes')
        )
      ORDER BY (status = 'pending') DESC, id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const next = rows[0];
    if (!next) return null;

    await tx
      .update(queueAssignments)
      .set({ status: "assigned", agentId, assignedAt: new Date() })
      .where(sql`id = ${next.id}`);

    return { id: next.id, contactId: next.contact_id };
  });
}
