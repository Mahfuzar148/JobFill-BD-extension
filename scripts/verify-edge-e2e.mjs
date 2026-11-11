import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { runBrowserExtensionE2E } from './verify-browser-e2e-shared.mjs';

const ROOT = process.cwd();
const EDGE_EXE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_ZIP = path.resolve(ROOT, 'release', 'JobFill-BD-Edge.zip');

function resolvePlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require(require.resolve('playwright'));
  } catch {
    const npxCache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
    if (fs.existsSync(npxCache)) {
      for (const dir of fs.readdirSync(npxCache)) {
        const candidate = path.join(npxCache, dir, 'node_modules', 'playwright', 'index.js');
        if (fs.existsSync(candidate)) return require(candidate);
      }
    }
  }
  throw new Error('Playwright not found.');
}

async function testExtractedProductionEdgeZip() {
  if (!fs.existsSync(EDGE_ZIP)) {
    throw new Error(`Production ZIP not found: ${EDGE_ZIP}`);
  }
  if (!fs.existsSync(EDGE_EXE)) {
    throw new Error(`Microsoft Edge Stable not found at: ${EDGE_EXE}`);
  }

  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfill-edge-zip-extract-'));
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfill-edge-zip-profile-'));
  const { chromium } = resolvePlaywright();

  let context;
  const consoleErrors = [];
  const pageErrors = [];
  const swErrors = [];

  try {
    console.log(`\n📦 Extracting ${EDGE_ZIP} -> ${extractDir}`);
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${EDGE_ZIP}', '${extractDir}')`,
      ],
      { stdio: 'inherit' }
    );

    if (!fs.existsSync(path.join(extractDir, 'manifest.json'))) {
      throw new Error('manifest.json missing at root of extracted ZIP');
    }
    if (fs.existsSync(path.join(extractDir, 'test-pages'))) {
      throw new Error('Forbidden test-pages directory present in extracted ZIP');
    }

    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: EDGE_EXE,
      headless: false,
      args: [
        `--disable-extensions-except=${extractDir}`,
        `--load-extension=${extractDir}`,
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    let [sw] = context.serviceWorkers();
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 12000 }).catch(() => null);
    }
    if (!sw) {
      throw new Error('Production Edge ZIP Service Worker failed to start.');
    }
    sw.on('pageerror', (err) => swErrors.push(err.message));
    const extId = sw.url().split('/')[2];

    const dash = await context.newPage();
    dash.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`[ProdDash] ${m.text()}`);
    });
    dash.on('pageerror', (e) => pageErrors.push(`[ProdDash] ${e.message}`));

    await dash.goto(`chrome-extension://${extId}/dashboard.html`, { waitUntil: 'networkidle' });
    const skipBtn = dash.locator('button[title="Skip Onboarding"], button:has-text("Skip"), button:has-text("স্কিপ")').first();
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
      await dash.waitForTimeout(250);
    }

    const ua = await dash.evaluate(() => navigator.userAgent);
    const activeOptText = await dash.locator('header select option:checked').first().innerText();
    if (!activeOptText.includes('My Job Profile')) {
      throw new Error(`Expected clean initial profile "My Job Profile" in production ZIP, got "${activeOptText}"`);
    }

    // Verify TabManager.openOrFocusDashboard works cleanly without "tabs" permission (no duplicate Dashboard tabs)
    const beforeDashPages = context.pages().length;
    await dash.evaluate(
      () =>
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'openDashboard', query: '?tab=security' }, (res) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(res);
          });
        })
    );
    await dash.waitForTimeout(350);
    const afterDashPages = context.pages().length;
    if (afterDashPages !== beforeDashPages) {
      throw new Error(`Expected openDashboard to focus existing Dashboard tab instead of opening duplicate (${beforeDashPages} -> ${afterDashPages})`);
    }
    console.log('✅ [EDGE-PRODUCTION-ZIP] TabManager.openOrFocusDashboard focuses existing tab cleanly without "tabs" permission.');

    // Verify Circulars, Search, Security, Privacy pages inside extracted ZIP build
    await dash.goto(`chrome-extension://${extId}/dashboard.html?tab=circulars`, { waitUntil: 'networkidle' });
    await dash.waitForSelector('[data-testid="compact-source-health"]', { timeout: 6000 });
    await dash.goto(`chrome-extension://${extId}/dashboard.html?tab=search`, { waitUntil: 'networkidle' });
    await dash.waitForSelector('input[type="search"]', { timeout: 6000 });

    // Verify Security tab in Edge Store ZIP isolates Cloud Sync & updates Sidebar label
    await dash.goto(`chrome-extension://${extId}/dashboard.html?tab=security`, { waitUntil: 'networkidle' });
    await dash.waitForSelector('[data-testid="edge-local-only-sync-notice"]', { timeout: 6000 });
    const secBodyText = await dash.evaluate(() => document.body.innerText);
    if (!secBodyText.includes('Local-First (Cloud Disabled)') || !secBodyText.includes('Local-First & Locally Encrypted')) {
      throw new Error('Edge production ZIP missing expected Local-First / Cloud Disabled compliance labels');
    }
    if (secBodyText.includes('100% Offline') || secBodyText.includes('Enable Cloud Sync')) {
      throw new Error('Edge production ZIP leaked misleading 100% Offline label or active Cloud Sync control');
    }
    const supaInputCount = await dash.locator('input[placeholder*="Supabase Project URL"]').count();
    if (supaInputCount > 0) {
      throw new Error('Edge production ZIP unexpectedly rendered Supabase Cloud Sync configuration input');
    }

    await dash.goto(`chrome-extension://${extId}/dashboard.html?tab=history`, { waitUntil: 'networkidle' });
    await dash.waitForSelector('h2', { timeout: 6000 });
    const histBodyText = await dash.evaluate(() => document.body.innerText);
    if (!histBodyText.includes('Locally Stored Autofill History') || histBodyText.includes('Offline-only audit trail')) {
      throw new Error('Edge production ZIP History page failed audit-trail label compliance check');
    }

    await dash.goto(`chrome-extension://${extId}/privacy.html`, { waitUntil: 'networkidle' });
    const privTitle = await dash.title();
    if (!privTitle.includes('Privacy Policy')) {
      throw new Error(`Unexpected privacy.html title: ${privTitle}`);
    }
    const privText = await dash.evaluate(() => document.body.innerText);
    for (const reqSnippet of ['MR Software Studio', 'mahfuzar148@gmail.com', 'https://mahfuzar148.github.io/jobfill-bd-privacy/', 'Cloud Sync Disabled']) {
      if (!privText.includes(reqSnippet)) {
        throw new Error(`Bundled privacy.html in Edge ZIP missing expected disclosure text: "${reqSnippet}"`);
      }
    }

    const popup = await context.newPage();
    popup.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`[ProdPopup] ${m.text()}`);
    });
    popup.on('pageerror', (e) => pageErrors.push(`[ProdPopup] ${e.message}`));
    await popup.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'networkidle' });
    const popupHeading = await popup.locator('h1').first().innerText();
    const popupFooterText = await popup.locator('footer').innerText();
    if (!popupFooterText.includes('Local-First Profile Vault') || popupFooterText.includes('100% Offline')) {
      throw new Error(`Popup footer compliance check failed: "${popupFooterText}"`);
    }
    await popup.close();

    // Verify content script auto-injection + HTTP warning + close (x) button on mocked *.teletalk.com.bd in production ZIP
    const ttPage = await context.newPage();
    await ttPage.route('http://mockportal.teletalk.com.bd/apply*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html><head><title>Online Application Form</title></head><body>
          <form>
            <label for="app_name">Applicant's Name</label><input id="app_name" name="applicant_name" type="text" />
            <label for="f_name">Father's Name</label><input id="f_name" name="father_name" type="text" />
            <label for="nid_no">National ID</label><input id="nid_no" name="nid" type="text" />
          </form></body></html>`,
      });
    });
    await ttPage.goto('http://mockportal.teletalk.com.bd/apply', { waitUntil: 'load' });
    await ttPage.waitForSelector('#jobfill-close-toolbar-btn', { timeout: 7000 });
    await ttPage.click('#jobfill-close-toolbar-btn');
    await ttPage.waitForTimeout(200);
    const hiddenOk = await ttPage.evaluate(() => {
      const el = document.getElementById('jobfill-floating-trigger');
      return !el || el.style.display === 'none';
    });
    if (!hiddenOk) throw new Error('Production ZIP floating toolbar close (x) failed');
    await ttPage.close();

    // Verify Google Meet remains excluded in extracted production ZIP
    const meetPage = await context.newPage();
    await meetPage.route('https://meet.google.com/abc-defg-hij*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><video></video></body></html>' });
    });
    await meetPage.goto('https://meet.google.com/abc-defg-hij', { waitUntil: 'load' });
    await meetPage.waitForTimeout(400);
    const meetNodes = await meetPage.evaluate(() => document.querySelectorAll('[id^="jobfill-"]').length);
    await meetPage.close();
    if (meetNodes !== 0) throw new Error(`Production ZIP leaked DOM nodes onto Meet: ${meetNodes}`);

    if (consoleErrors.length || pageErrors.length || swErrors.length) {
      throw new Error(`Extracted production ZIP Edge runtime errors: ${JSON.stringify({ consoleErrors, pageErrors, swErrors })}`);
    }

    console.log(`✅ [EDGE-PRODUCTION-ZIP] Extracted release/JobFill-BD-Edge.zip verified cleanly in Edge! UA="${ua}" | Popup="${popupHeading.replace(/\s+/g, ' ')}" | 0 errors`);
  } finally {
    if (context) await context.close().catch(() => {});
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

(async () => {
  await runBrowserExtensionE2E('edge');
  await testExtractedProductionEdgeZip();
})().catch((err) => {
  console.error('❌ Microsoft Edge E2E Error:', err.message);
  process.exit(1);
});
