// Shared field validators used by controllers. Kept framework-free (plain
// functions returning true/false or a normalized value) so they're easy to
// unit test and reuse between controllers.

const NUMERIC_RE = /^\d+(\.\d+)?$/;
const ALPHA_NO_SPACE_RE = /^[A-Za-z]+$/;
const MOBILE_RE = /^\d{10}$/;
// Standard GSTIN pattern: 2-digit state code + 10-char PAN + entity code + 'Z' + checksum
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const isNumeric = (v) => typeof v !== 'undefined' && v !== null && v !== '' && NUMERIC_RE.test(String(v).trim());
const isAlphaNoSpace = (v) => typeof v === 'string' && ALPHA_NO_SPACE_RE.test(v);
const isMobile = (v) => typeof v === 'string' && MOBILE_RE.test(v);
const isDealerCode = (v) => typeof v === 'string' && v.length === 5;
const isGstin = (v) => typeof v === 'string' && GSTIN_RE.test(v);

function required(fields, body) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  return missing;
}

module.exports = { isNumeric, isAlphaNoSpace, isMobile, isDealerCode, isGstin, required };
