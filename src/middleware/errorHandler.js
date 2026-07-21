const multer = require("multer");

// Centralized error handler -- keeps route handlers free of repetitive
// try/catch response formatting and ensures we never leak stack traces
// to clients.
function errorHandler(err, req, res, next) {
  console.error("[error]", err.message, process.env.NODE_ENV === "development" ? err.stack : "");

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err.message && err.message.startsWith("Unsupported file type")) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: "Internal server error." });
}

module.exports = { errorHandler };
