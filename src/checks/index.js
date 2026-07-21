const { checkBrightness } = require("./brightness");
const { checkBlur } = require("./blur");
const { checkDuplicate } = require("./duplicate");
const { checkScreenshot } = require("./screenshotDetection");
const { checkPlateValidation } = require("./plateValidation");

// Each check is isolated: if one throws (e.g. tesseract fails to load, a
// corrupt image trips sharp), we record it as a failed *check* with the
// error captured in details, rather than failing the entire job. This
// matters because "the image is unreadable" is itself useful signal, and we
// don't want one flaky check (OCR is the most failure-prone) to discard
// four other checks that succeeded.
async function runAllChecks(imagePath, imageId) {
  const checkFns = [
    { name: "brightness", fn: () => checkBrightness(imagePath) },
    { name: "blur", fn: () => checkBlur(imagePath) },
    { name: "duplicate", fn: () => checkDuplicate(imagePath, imageId) },
    { name: "screenshot_detection", fn: () => checkScreenshot(imagePath) },
    { name: "plate_ocr_validation", fn: () => checkPlateValidation(imagePath) },
  ];

  const results = await Promise.all(
    checkFns.map(async ({ name, fn }) => {
      try {
        return await fn();
      } catch (err) {
        return {
          checkName: name,
          passed: false,
          confidence: null,
          details: { error: err.message, checkCrashed: true },
        };
      }
    })
  );

  return results;
}

module.exports = { runAllChecks };
