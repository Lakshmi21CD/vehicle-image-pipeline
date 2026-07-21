const { Queue } = require("bullmq");

// BullMQ requires a Redis connection. We centralize the connection config
// here so both the Queue (producer, in server.js) and Worker (consumer, in
// worker.js) use identical settings.
const connection = {
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
