const express = require("express");
const path = require("path");
const prisma = require("../db/prisma");
const { upload } = require("../middleware/upload");
const { imageQueue } = require("../queue/imageQueue");

const router = express.Router();

// POST /api/images - upload an image, create metadata record, enqueue job.
// Returns 202 Accepted immediately -- processing happens async.
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided. Use form field name 'image'." });
    }

    const image = await prisma.image.create({
      data: {
        originalName: req.file.originalname,
        storagePath: req.file.path,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        status: "pending",
      },
    });

    await imageQueue.add(
      "analyze-image",
      { imageId: image.id, imagePath: image.storagePath },
      { jobId: image.id } // dedupe/traceability: job id == image id
    );

    return res.status(202).json({
      id: image.id,
      status: image.status,
      message: "Image accepted for processing.",
      statusUrl: `/api/images/${image.id}/status`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/images/:id/status - lightweight status check
router.get("/:id/status", async (req, res, next) => {
  try {
    const image = await prisma.image.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        failureReason: true,
        attempts: true,
        createdAt: true,
        processingStartedAt: true,
        processingEndedAt: true,
      },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found." });
    }

    return res.json(image);
  } catch (err) {
    next(err);
  }
});

// GET /api/images/:id/results - full analysis results (only meaningful once completed)
router.get("/:id/results", async (req, res, next) => {
  try {
    const image = await prisma.image.findUnique({
      where: { id: req.params.id },
      include: { results: true },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found." });
    }

    if (image.status !== "completed") {
      return res.status(409).json({
        error: `Results not available yet. Current status: ${image.status}.`,
        status: image.status,
      });
    }

    const issuesDetected = image.results.filter((r) => !r.passed).map((r) => r.checkName);

    return res.json({
      id: image.id,
      status: image.status,
      summary: {
        totalChecks: image.results.length,
        issuesDetected,
        hasIssues: issuesDetected.length > 0,
      },
      results: image.results.map((r) => ({
        checkName: r.checkName,
        passed: r.passed,
        confidence: r.confidence,
        details: r.details,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/images/:id/failure - failure reason, if failed
router.get("/:id/failure", async (req, res, next) => {
  try {
    const image = await prisma.image.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, failureReason: true, attempts: true },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found." });
    }

    if (image.status !== "failed") {
      return res.status(409).json({
        error: `Image has not failed. Current status: ${image.status}.`,
        status: image.status,
      });
    }

    return res.json({
      id: image.id,
      status: image.status,
      attempts: image.attempts,
      failureReason: image.failureReason,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/images - list all images (bonus, useful for a dashboard/debugging)
router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const images = await prisma.image.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        originalName: true,
        status: true,
        createdAt: true,
      },
    });
    return res.json({ count: images.length, images });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
