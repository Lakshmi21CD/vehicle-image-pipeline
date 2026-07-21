const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Generate our own filename rather than trusting the client's, to avoid
    // path traversal and collisions. Original name is preserved separately
    // in the DB for display purposes.
    const ext = path.extname(file.originalname) || guessExtFromMime(file.mimetype);
    cb(null, `${uuidv4()}${ext}`);
  },
});

function guessExtFromMime(mime) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    // Reject with a clear error the route handler/error middleware can surface.
    return cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp.`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024,
  },
});

module.exports = { upload, UPLOAD_DIR };
