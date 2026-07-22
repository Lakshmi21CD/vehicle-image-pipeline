require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const imagesRouter = require("./routes/images");
const { errorHandler } = require("./middleware/errorHandler");
const { createWorker } = require("./queue/worker");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
);
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../public")));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/images", imagesRouter);

// Serve frontend homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Error handler
app.use(errorHandler);

// Start background worker
const worker = createWorker();

// Start server
const server = app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  console.log(
    `Worker running in-process (concurrency: ${
      process.env.WORKER_CONCURRENCY || 2
    })`
  );
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n[server] received ${signal}, shutting down gracefully...`);

  server.close();

  await worker.close();

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;