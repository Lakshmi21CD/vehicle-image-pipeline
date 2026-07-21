const sharp = require("sharp");
const exifr = require("exifr");

// Heuristic combination (no single signal is reliable alone):
//
// 1. EXIF metadata: real camera/phone photos almost always carry EXIF data
//    (Make, Model, DateTimeOriginal, GPS, etc). Screenshots never have camera
//    EXIF. Re-uploaded/downloaded images often get EXIF stripped by messaging
//    apps too -- so *absence* of EXIF is a weak-to-moderate signal, not proof.
// 2. Common screenshot aspect ratios / exact device resolutions (e.g. exact
//    1170x2532 iPhone screen size, or suspiciously "round" dimensions).
// 3. PNG format is more common for screenshots than real photos (phone
//    cameras output JPEG almost universally); PNG + no EXIF raises suspicion.
//
// This is explicitly a heuristic, not a classifier -- flagged as
// "structuring uncertainty" in the README rather than claiming accuracy.

const COMMON_SCREENSHOT_RESOLUTIONS = [
  [1170, 2532], [1080, 2400], [1080, 2340], [1440, 3200],
  [750, 1334], [828, 1792], [1242, 2688], [1920, 1080], [2560, 1440],
];

function matchesKnownScreenshotResolution(width, height) {
  return COMMON_SCREENSHOT_RESOLUTIONS.some(
    ([w, h]) => (width === w && height === h) || (width === h && height === w)
  );
}

async function checkScreenshot(imagePath) {
  const metadata = await sharp(imagePath).metadata();
  const { width, height, format } = metadata;

  let exifData = null;
  try {
    exifData = await exifr.parse(imagePath, { pick: ["Make", "Model", "DateTimeOriginal"] });
  } catch {
    // Corrupt/absent EXIF segment -- treat as "no EXIF" rather than failing the check.
    exifData = null;
  }

  const hasCameraExif = Boolean(exifData && (exifData.Make || exifData.Model));
  const isKnownScreenResolution = matchesKnownScreenshotResolution(width, height);
  const isPngNoExif = format === "png" && !hasCameraExif;

  // Simple point-based suspicion score rather than a black-box probability.
  let suspicionPoints = 0;
  if (!hasCameraExif) suspicionPoints += 1;
  if (isKnownScreenResolution) suspicionPoints += 2;
  if (isPngNoExif) suspicionPoints += 1;

  const isSuspectedScreenshot = suspicionPoints >= 2;
  const passed = !isSuspectedScreenshot;

  return {
    checkName: "screenshot_detection",
    passed,
    confidence: Number(Math.min(1, suspicionPoints / 4).toFixed(2)),
    details: {
      hasCameraExif,
      isKnownScreenResolution,
      format,
      dimensions: { width, height },
      suspicionPoints,
      isSuspectedScreenshot,
    },
  };
}

module.exports = { checkScreenshot };
