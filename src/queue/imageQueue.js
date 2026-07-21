const { Queue } = require("bullmq");
const IORedis = require("ioredis");

// BullMQ requires a Redis connection. We centralize the connection config
// here so both the Queue (producer, in server.js) and Worker (consumer, in
// worker.js) use identical settings.
//
// Hosted Redis (Railway, Render, etc.) typically requires a password and
// exposes a single connection string (REDIS_URL) with the password embedded,
// rather than separate host/port env vars. We prefer REDIS_URL when present
// and fall back to host/port for local dev (e.g. Memurai on Windows, which
// has no password by default). BullMQ expects a connection-options object
// or an ioredis client instance -- not a raw string -- so when REDIS_URL is
// set we construct an actual IORedis client from it.
const connection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
    };

const QUEUE_NAME = "image-analysis";

const imageQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.JOB_MAX_ATTEMPTS) || 3,
    backoff: {
      type: "exponential",
      delay: Number(process.env.JOB_BACKOFF_MS) || 2000,
    },
    // Keep completed/failed jobs briefly for debugging via BullMQ, but don't
    // let Redis grow unbounded. The source of truth for results is Postgres,
    // not the job payload.
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

module.exports = { imageQueue, connection, QUEUE_NAME };