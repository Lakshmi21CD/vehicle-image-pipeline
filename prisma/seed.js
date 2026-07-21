// Generates a handful of synthetic test images locally (no external fixtures
// needed) covering different scenarios: normal, dark, blurry, bright.
// These get saved to /seed-images so you can immediately try the upload API
// without hunting for sample photos.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "seed-images");

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Normal-ish image with real sharp edges (simulates a decent, in-focus
  // photo). A checkerboard-style SVG gives strong, high-contrast edges so
  // the Laplacian-variance blur check correctly reads this as "sharp" --
  // a low-alpha noise overlay (first attempt) was too subtle and produced
  // near-zero edge variance, which would have made this fixture misleadingly
  // fail its own "normal" check. Caught via smoke test, see README AI-usage notes.
  const checkerboardSvg = buildCheckerboardSvg(800, 600, 40);
  await sharp(Buffer.from(checkerboardSvg)).jpeg().toFile(path.join(OUT_DIR, "normal.jpg"));

  // Dark/low-light image
  await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 15, g: 15, b: 15 } },
  })
    .jpeg()
    .toFile(path.join(OUT_DIR, "low_light.jpg"));

  // Overexposed/bright image
  await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 250, g: 250, b: 250 } },
  })
    .jpeg()
    .toFile(path.join(OUT_DIR, "overexposed.jpg"));

  // Blurry image: solid color blurred heavily (near-zero edge variance)
  await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .blur(20)
    .jpeg()
    .toFile(path.join(OUT_DIR, "blurry.jpg"));

  // PNG with no EXIF (simulates a screenshot)
  await sharp({
    create: { width: 1080, height: 2400, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .png()
    .toFile(path.join(OUT_DIR, "screenshot_like.png"));

  console.log(`Seed images written to ${OUT_DIR}:`);
  fs.readdirSync(OUT_DIR).forEach((f) => console.log(`  - ${f}`));
  console.log("\nTry uploading one, e.g.:");
  console.log(
    `  curl -F "image=@seed-images/blurry.jpg" http://localhost:3000/api/images`
  );
}

// Generates a checkerboard pattern as SVG -- gives genuine high-frequency
// edges (unlike a flat color or barely-visible noise overlay), so the blur
// check has a realistic "sharp" fixture to compare against blurry.jpg.
function buildCheckerboardSvg(width, height, cellSize) {
  const rects = [];
  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      const isDark = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
      if (isDark) {
        rects.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#333"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#ddd"/>
    ${rects.join("\n")}
  </svg>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
