const { Worker } = require("bullmq");
const prisma = require("../db/prisma");
const { connection, QUEUE_NAME } = require("./imageQueue");
const { runAllChecks } = require("../checks");

// Concurrency: how many jobs this worker processes in parallel. Image
// analysis (especially OCR) is CPU-bound, so we keep this modest to avoid
// starving the event loop / thrashing CPU. Tunable via env for different
// hardware; documented as a scaling knob in the README.
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 2;

function createWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { imageId, imagePath } = job.data;
      console.log(`[worker] starting job ${job.id} for image ${imageId} (attempt ${job.attemptsMade + 1})`);

      await prisma.image.update({
        where: { id: imageId },
        data: {
          status: "processing",
          processingStartedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      const results = await runAllChecks(imagePath, imageId);

      // Persist all check results. If this write fails, BullMQ's retry will
      // re-run the whole job -- acceptable here since checks are
      // deterministic/idempotent (duplicate check re-queries current state).
      await prisma.$transaction(
        results.map((r) =>
          prisma.analysisResult.create({
            data: {
              imageId,
              checkName: r.checkName,
              passed: r.passed,
              confidence: r.confidence,
              details: r.details,
            },
          })
        )
      );

      await prisma.image.update({
        where: { id: imageId },
        data: { status: "completed", processingEndedAt: new Date() },
      });

      console.log(`[worker] completed job ${job.id} for image ${imageId}`);
      return { checksRun: results.length };
    },
    { connection, concurrency: CONCURRENCY }
  );

  worker.on("failed", async (job, err) => {
    console.error(`[worker] job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);

    // Only mark as permanently "failed" once BullMQ has exhausted retries.
    // Otherwise a job that will be retried would incorrectly show as failed
    // to API consumers in between attempts.
    const willRetry = job && job.attemptsMade < job.opts.attempts;
    if (!willRetry && job) {
      await prisma.image.update({
        where: { id: job.data.imageId },
        data: {
          status: "failed",
          failureReason: err.message,
          processingEndedAt: new Date(),
        },
      }).catch((dbErr) => {
        console.error("[worker] failed to persist failure state:", dbErr.message);
      });
    }
  });

  worker.on("error", (err) => {
    // Worker-level errors (e.g. lost Redis connection) rather than job errors.
    console.error("[worker] worker error:", err.message);
  });

  return worker;
}

module.exports = { createWorker };
