import { sql } from "drizzle-orm";
import { db, queueAssignments } from "@an-telephony-tools/core";

export interface ClaimedAssignment {
  id: string;
  contactId: string;
}

// FOR UPDATE SKIP LOCKED is what guarantees two agents never get handed the same
// contact even when they claim concurrently.
export async function claimNextContact(
  campaignId: string,
  agentId: string
): Promise<ClaimedAssignment | null> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; contact_id: string }>(sql`
      SELECT id, contact_id FROM queue_assignments
      WHERE campaign_id = ${campaignId} AND status = 'pending'
      ORDER BY id
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
