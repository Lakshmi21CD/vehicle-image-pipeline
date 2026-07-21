const sharp = require("sharp");
const prisma = require("../db/prisma");

// Simple average-hash (aHash) perceptual hash:
// 1. Shrink to 8x8 grayscale (loses detail, keeps overall structure)
// 2. Compute mean pixel value
// 3. Each pixel > mean => 1 bit, else 0 bit => 64-bit hash
// This is intentionally simple (not DCT-based pHash) -- easy to explain and
// implement without extra deps, good enough to catch near-identical/re-uploaded
// images, resize/compression artifacts. It will NOT catch duplicates that are
// meaningfully cropped, rotated, or heavily edited -- documented limitation.
const HASH_SIZE = 8;

async function computeAverageHash(imagePath) {
  const { data } = await sharp(imagePath)
    .resize(HASH_SIZE, HASH_SIZE, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mean = data.reduce((a, b) => a + b, 0) / data.length;

  let hash = "";
  for (let i = 0; i < data.length; i++) {
    hash += data[i] > mean ? "1" : "0";
  }
  return hash; // 64-char binary string
}

function hammingDistance(hashA, hashB) {
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) distance++;
  }
  return distance;
}

async function checkDuplicate(imagePath, imageId) {
  const hash = await computeAverageHash(imagePath);
  const threshold = Number(process.env.DUPLICATE_HAMMING_THRESHOLD) || 6;

  // Compare against previously completed images' stored hashes.
  // NOTE: this scans all prior "duplicate" check results -- fine for a
  // take-home dataset size, but would need an indexed/approximate-nearest-
  // neighbor approach (e.g. LSH, vector DB) at real scale. Called out in README.
  const priorResults = await prisma.analysisResult.findMany({
    where: {
      checkName: "duplicate",
      imageId: { not: imageId },
    },
    select: { imageId: true, details: true },
  });

  let closestMatch = null;
  let closestDistance = Infinity;

  for (const result of priorResults) {
    const priorHash = result.details?.hash;
    if (!priorHash) continue;
    const distance = hammingDistance(hash, priorHash);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestMatch = result.imageId;
    }
  }

  const isDuplicate = closestMatch !== null && closestDistance <= threshold;
  const passed = !isDuplicate;

  return {
    checkName: "duplicate",
    passed,
    confidence: isDuplicate
      ? Number((1 - closestDistance / threshold).toFixed(2))
      : null,
    details: {
      hash,
      threshold,
      isDuplicate,
      matchedImageId: isDuplicate ? closestMatch : null,
      hammingDistance: closestMatch !== null ? closestDistance : null,
    },
  };
}

module.exports = { checkDuplicate, computeAverageHash, hammingDistance };
