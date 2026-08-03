import type { FastifyInstance } from "fastify";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ActionNetworkClient, runSync } from "@an-telephony-tools/action-network";

const QUEUE_NAME = "action-network-sync";
const JOB_NAME = "sync";
const REPEAT_JOB_ID = "action-network-periodic-sync";

export function registerActionNetworkSync(app: FastifyInstance): void {
  const apiKey = process.env.ACTION_NETWORK_API_KEY;
  if (!apiKey) {
    app.log.warn("ACTION_NETWORK_API_KEY not set — Action Network sync is disabled");
    return;
  }

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const client = new ActionNetworkClient(apiKey);

  const queue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const result = await runSync(client);
      app.log.info(result, "Action Network sync complete");
      return result;
    },
    { connection }
  );

  const intervalMinutes = Number(process.env.ACTION_NETWORK_SYNC_INTERVAL_MINUTES ?? 15);

  // jobId dedupes repeatable jobs, so re-registering this on every boot is a no-op
  // if the schedule hasn't changed rather than piling up duplicate repeat jobs.
  queue
    .add(JOB_NAME, {}, { repeat: { every: intervalMinutes * 60 * 1000 }, jobId: REPEAT_JOB_ID })
    .catch((err) => app.log.error(err, "Failed to schedule Action Network sync"));

  app.log.info(`Action Network sync scheduled every ${intervalMinutes} minutes`);

  app.addHook("onClose", async () => {
    await worker.close();
    await queue.close();
    await connection.quit();
  });
}
