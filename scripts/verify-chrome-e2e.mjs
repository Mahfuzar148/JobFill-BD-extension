import { runBrowserExtensionE2E } from './verify-browser-e2e-shared.mjs';

runBrowserExtensionE2E('chrome').catch((err) => {
  const msg = String(err?.message || err);
  console.error('❌ Google Chrome E2E Error:', msg);
  if (msg.includes('Background Service Worker failed to start')) {
    console.error(
      'ℹ️ Diagnostic: Branded Google Chrome (M137+, observed 157.0.8103.40) blocks CLI --load-extension for automated launches.\n' +
      '   To run automated Chrome E2E, set CHROME_EXE=<path to Chrome for Testing / Chromium>, or load release/chrome/unpacked manually via chrome://extensions Developer Mode.'
    );
  }
  process.exit(1);
});
