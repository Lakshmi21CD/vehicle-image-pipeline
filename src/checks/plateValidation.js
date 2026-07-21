const Tesseract = require("tesseract.js");

// Indian vehicle registration plate format (standard, post-1989 scheme):
//   [State code: 2 letters][RTO code: 1-2 digits][Series: 1-3 letters][Number: 4 digits]
// e.g. "MH12AB1234", "DL3CAA0001"
// We deliberately keep this permissive on the series/RTO segments since
// real-world plates vary (some states use 1 digit RTO codes, series can be
// 0-3 letters in edge cases like BH-series). Documented as a known
// simplification -- perfect plate validation is its own project.
const PLATE_REGEX = /\b([A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{4})\b/;

function normalizePlateCandidate(text) {
  return text.replace(/[\s-]/g, "").toUpperCase();
}

async function checkPlateValidation(imagePath) {
  let ocrText = "";
  let ocrError = null;

  try {
    const result = await Tesseract.recognize(imagePath, "eng", {
      // Keep logging quiet; tesseract.js is chatty by default.
      logger: () => {},
    });
    ocrText = result.data.text || "";
  } catch (err) {
    ocrError = err.message;
  }

  if (ocrError) {
    // OCR failure is not the same as "no plate found" -- surface distinctly
    // so callers/UI can differentiate "couldn't read" from "invalid format".
    return {
      checkName: "plate_ocr_validation",
      passed: false,
      confidence: null,
      details: { ocrError, rawText: null, extractedPlate: null },
    };
  }

  const match = ocrText.match(PLATE_REGEX);
  const extractedPlate = match ? normalizePlateCandidate(match[1]) : null;
  const isValidFormat = Boolean(extractedPlate);

  return {
    checkName: "plate_ocr_validation",
    passed: isValidFormat,
    confidence: isValidFormat ? 0.7 : 0.3, // OCR-based confidence is inherently rough
    details: {
      rawText: ocrText.trim().slice(0, 500), // cap stored size
      extractedPlate,
      isValidFormat,
      note: "Regex validates standard Indian plate structure; does not verify against an RTO database.",
    },
  };
}

module.exports = { checkPlateValidation, PLATE_REGEX };
