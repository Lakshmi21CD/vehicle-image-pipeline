const sharp = require("sharp");

// Classic "variance of Laplacian" blur metric: apply a Laplacian edge-detection
// kernel, then take the variance of the result. Sharp images have high-variance
// edges; blurry images have low variance because edges are smoothed out.
// This is a well-known, cheap heuristic (no ML model needed) commonly used
// for exactly this kind of blur triage.
const BLUR_VARIANCE_THRESHOLD = 100; // below this => likely blurry (tuned empirically, not universal)

// Downscaling first keeps this fast and stable across different image sizes;
// otherwise variance scales with resolution and thresholds become meaningless.
const RESIZE_WIDTH = 600;

async function checkBlur(imagePath) {
  const { data, info } = await sharp(imagePath)
    .resize({ width: RESIZE_WIDTH, withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const laplacian = applyLaplacian(data, width, height);
  const variance = computeVariance(laplacian);

  const passed = variance >= BLUR_VARIANCE_THRESHOLD;

  return {
    checkName: "blur",
    passed,
    confidence: Number(
      Math.min(1, Math.max(0, 1 - variance / BLUR_VARIANCE_THRESHOLD)).toFixed(2)
    ),
    details: {
      laplacianVariance: Number(variance.toFixed(2)),
      threshold: BLUR_VARIANCE_THRESHOLD,
    },
  };
}

// 3x3 Laplacian kernel: [0,1,0 / 1,-4,1 / 0,1,0]
function applyLaplacian(pixels, width, height) {
  const output = new Float64Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const value =
        pixels[idx - width] +
        pixels[idx + width] +
        pixels[idx - 1] +
        pixels[idx + 1] -
        4 * pixels[idx];
      output[idx] = value;
    }
  }
  return output;
}

function computeVariance(arr) {
  const n = arr.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += arr[i];
  const mean = sum / n;

  let sqDiffSum = 0;
  for (let i = 0; i < n; i++) sqDiffSum += (arr[i] - mean) ** 2;
  return sqDiffSum / n;
}

module.exports = { checkBlur };
