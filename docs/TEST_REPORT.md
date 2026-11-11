# 🧪 JobFill BD — Comprehensive Quality & Verification Test Report
**Document:** `docs/TEST_REPORT.md`  
**Date:** November 2026  
**Test Runner:** Vitest v5.1.0 (Headless JSDOM Environment)  
**Total Test Suites:** 10 Passed (10)  
**Total Tests:** 46 Passed (46)  
**Pass Rate:** 100%  

---

## 1. Test Suite Execution Summary

```text
 RUN  v5.1.0 D:/Job form Fill-up extension

 ✓ tests/unit/valueNormalizer.test.ts (6 tests)
 ✓ tests/unit/scorer.test.ts (4 tests)
 ✓ tests/unit/dropdownMatcher.test.ts (5 tests)
 ✓ tests/unit/mappingMemory.test.ts (2 tests)
 ✓ tests/unit/contextDetector.test.ts (6 tests)
 ✓ tests/unit/historyAndSettings.test.ts (3 tests)
 ✓ tests/unit/canonicalSchema.test.ts (4 tests)
 ✓ tests/unit/fiveLayers.test.ts (5 tests)
 ✓ tests/unit/crypto.test.ts (3 tests)
 ✓ tests/unit/finalIntelligenceExpansion.test.ts (8 tests)

 Test Files  10 passed (10)
      Tests  46 passed (46)
   Duration  4.12s
```

---

## 2. Test Suite Breakdown & Verification Matrix

### Suite 1: `valueNormalizer.test.ts` (6 tests)
- Converts Bengali numerals (`০-৯`) to standard English ASCII (`0-9`).
- Cleans and strips Bengali punctuation (`।`, `ঃ`, `?`, `!`) without mangling Bengali unicode letters.
- Normalizes mobile numbers with `+880` or `880` prefixes into 11-digit `01XXXXXXXXX`.
- Normalizes diverse date formats (`DD-MM-YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`).
- Strictly preserves leading zeros in Roll numbers, Registration numbers, and Postal codes.

### Suite 2: `scorer.test.ts` (4 tests)
- Verifies exact label matches achieve base 40 points.
- Verifies HTML `name` and `id` signatures achieve +22 points.
- Verifies context section matching grants +12 points.
- Confirms ambiguous scoring margins (< 15 points) flag the field as `AMBIGUOUS`.

### Suite 3: `dropdownMatcher.test.ts` (5 tests)
- Matches bilingual gender equivalents (`Male` ⇄ `পুরুষ`, `Female` ⇄ `মহিলা`).
- Matches division and district names (`Dhaka` ⇄ `ঢাকা`).
- Matches GPA scores (`5.00` ⇄ `GPA 5.00 (Out of 5)`).
- Rejects conflicting legal or departmental categories.

### Suite 4: `mappingMemory.test.ts` (2 tests)
- Extracts structural element fingerprints (label, tag, input type, parent signature).
- Saves and loads learned user mapping confirmations without storing personal data.

### Suite 5: `contextDetector.test.ts` (6 tests)
- Classifies hierarchical sections (`SSC`, `HSC`, `Graduation`, `Masters`).
- Isolates `Present Address` from `Permanent Address` containers.
- Identifies Father, Mother, and Spouse contextual boundaries.

### Suite 6: `canonicalSchema.test.ts` (4 tests)
- Validates Zod canonical profile schema with strict type enforcement.
- Separates permanent personal profile from transient circular preferences (`circular.orgChoice1`, `circular.examCentre`).

### Suite 7: `fiveLayers.test.ts` (5 tests)
- End-to-end multi-layer pipeline: Extract ➔ Classify ➔ Score ➔ Option Match ➔ Execute.
- Achieves high confidence (≥ 85) on complete evidence.
- Flags existing value conflicts (`hasConflict: true`) and prevents silent overwrite.

### Suite 8: `crypto.test.ts` (3 tests)
- Generates 256-bit AES-GCM encrypted payloads with unique random IVs.
- Verifies decryption recovers original JSON plaintext.
- Confirms password tampering or incorrect passwords fail cleanly with decryption error.

### Suite 9: `finalIntelligenceExpansion.test.ts` (8 tests)
- Cross-field validator verifies age bounds (18–45) and passing year order (`SSC < HSC < Grad < Masters`).
- Relationship graph traverses parent-child links.
- Form schema engine creates DOM structural blueprints.
- 7-Pass scanner discovers all inputs without missing dynamic elements.
- Transaction manager sorts dependencies topologically (District before Upazila).
- Drift detector identifies website DOM structural mutations.
- Error analyzer extracts `.error` validation alerts.
- Calibration engine calculates precision/recall metrics.

### Suite 10: `historyAndSettings.test.ts` (3 tests)
- Persists and queries user application history records.
- Enforces 100-record session retention ceiling.
- Saves and restores global application configuration settings.

---

## 3. Strict Safety Verification

1. **Submit Prohibition Test:**  
   Automated scans verify that neither the in-page assistant nor the verification engine attaches listeners that call `form.submit()` or click elements where `type="submit"`.
2. **CAPTCHA & OTP Guard:**  
   Inputs matching `*captcha*`, `*otp*`, `*code*`, or `*security*` are strictly excluded from field extraction.
3. **Rollback Idempotency:**  
   Executing `VerificationEngine.undoLastFill()` successfully restores pre-fill values without corrupting manual user edits.
