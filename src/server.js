require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const imagesRouter = require("./routes/images");
const { errorHandler } = require("./middleware/errorHandler");
const { createWorker } = require("./queue/worker");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use("/api/images", imagesRouter);

app.use((req, res) => res.status(404).json({ error: "Not found." }));
app.use(errorHandler);

// The worker runs in the same process as the API for simplicity in this
// take-home (see README trade-offs section). In production this would be a
// separate deployable so a burst of image-processing load can't degrade API
// responsiveness, and worker replicas could scale independently of API replicas.
const worker = createWorker();

const server = app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  console.log(`Worker running in-process (concurrency: ${process.env.WORKER_CONCURRENCY || 2})`);
});

// Graceful shutdown: let in-flight jobs finish before exiting so we don't
// leave images stuck in "processing" forever.
async function shutdown(signal) {
  console.log(`\n[server] received ${signal}, shutting down gracefully...`);
  server.close();
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;
