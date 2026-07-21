const sharp = require("sharp");

// Heuristic: convert to grayscale, compute mean pixel value (0-255).
// Low mean => dark/underexposed image. Thresholds are tuned loosely, not
// scientifically calibrated -- documented as an assumption in the README.
const LOW_LIGHT_THRESHOLD = 60; // mean below this => flagged as low light
const OVEREXPOSED_THRESHOLD = 220; // mean above this => flagged as blown out

async function checkBrightness(imagePath) {
  const stats = await sharp(imagePath).grayscale().stats();
  const mean = stats.channels[0].mean; // 0-255

  const isLowLight = mean < LOW_LIGHT_THRESHOLD;
  const isOverexposed = mean > OVEREXPOSED_THRESHOLD;
  const passed = !isLowLight && !isOverexposed;

  // Confidence: how far the mean is from the nearest threshold, normalized.
  // This is a simple linear proxy for "how confident are we this is an issue",
  // not a calibrated probability.
  let confidence = 1;
  if (isLowLight) {
    confidence = Math.min(1, (LOW_LIGHT_THRESHOLD - mean) / LOW_LIGHT_THRESHOLD);
  } else if (isOverexposed) {
    confidence = Math.min(1, (mean - OVEREXPOSED_THRESHOLD) / (255 - OVEREXPOSED_THRESHOLD));
  }

  return {
    checkName: "brightness",
    passed,
    confidence: Number(confidence.toFixed(2)),
    details: {
      meanBrightness: Number(mean.toFixed(2)),
      isLowLight,
      isOverexposed,
      thresholds: { low: LOW_LIGHT_THRESHOLD, high: OVEREXPOSED_THRESHOLD },
    },
  };
}

module.exports = { checkBrightness };
