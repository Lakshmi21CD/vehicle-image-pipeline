// Standalone smoke test: runs the individual check functions directly
// against seed images, without needing Postgres/Redis running. This is
// useful for quickly validating check logic in isolation. Duplicate check
// is skipped here since it depends on Prisma/DB.
const path = require("path");
const { checkBrightness } = require("../src/checks/brightness");
const { checkBlur } = require("../src/checks/blur");
const { checkScreenshot } = require("../src/checks/screenshotDetection");
const { PLATE_REGEX } = require("../src/checks/plateValidation");

const SEED_DIR = path.join(__dirname, "..", "seed-images");

async function run() {
  console.log("=== Brightness check ===");
  console.log("normal.jpg:", await checkBrightness(path.join(SEED_DIR, "normal.jpg")));
  console.log("low_light.jpg:", await checkBrightness(path.join(SEED_DIR, "low_light.jpg")));
  console.log("overexposed.jpg:", await checkBrightness(path.join(SEED_DIR, "overexposed.jpg")));

  console.log("\n=== Blur check ===");
  console.log("normal.jpg:", await checkBlur(path.join(SEED_DIR, "normal.jpg")));
  console.log("blurry.jpg:", await checkBlur(path.join(SEED_DIR, "blurry.jpg")));

  console.log("\n=== Screenshot detection ===");
  console.log("normal.jpg:", await checkScreenshot(path.join(SEED_DIR, "normal.jpg")));
  console.log("screenshot_like.png:", await checkScreenshot(path.join(SEED_DIR, "screenshot_like.png")));

  console.log("\n=== Plate regex sanity checks ===");
  const testCases = [
    ["MH12AB1234", true],
    ["DL3CAA0001", true],
    ["KA05MJ0987", true],
    ["random text no plate here", false],
    ["12345", false],
  ];
  let passed = 0;
  for (const [text, expected] of testCases) {
    const match = PLATE_REGEX.test(text);
    const ok = match === expected;
    if (ok) passed++;
    console.log(`  "${text}" -> matched=${match}, expected=${expected} [${ok ? "PASS" : "FAIL"}]`);
  }
  console.log(`Plate regex: ${passed}/${testCases.length} passed`);
}

run().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
