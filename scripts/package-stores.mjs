import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TARGET_ARG = process.argv.find((a) => a.startsWith('--target='))?.split('=')[1] || 'both';
const VALIDATE_ONLY = process.argv.includes('--validate-only');

const CHROME_EXES = [
  process.env.CHROME_EXE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const EDGE_EXES = [
  process.env.EDGE_EXE,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const TARGETS = {
  chrome: {
    name: 'Google Chrome Web Store',
    buildFlag: '--chrome-store',
    unpackedDir: path.resolve(ROOT, 'release', 'chrome', 'unpacked'),
    zipPath: path.resolve(ROOT, 'release', 'chrome', 'JobFill-BD-Chrome.zip'),
  },
  edge: {
    name: 'Microsoft Edge Add-ons Store',
    buildFlag: '--edge-store',
    unpackedDir: path.resolve(ROOT, 'release', 'edge', 'unpacked'),
    zipPath: path.resolve(ROOT, 'release', 'JobFill-BD-Edge.zip'),
  },
};

const STORE_ASSETS = path.resolve(ROOT, 'release', 'assets');

const FORBIDDEN_STORE_STRINGS = [
  '6014157074',
  'profile_mahfuzar_real',
  'MD. MAHFUZAR RAHMAN',
  'MD. MAHFUZUR RAHMAN',
  'mahfuz.developer.bd@gmail.com',
  'Mominpur',
  'Katihara',
  '420410',
  '203157',
  '19982692512345678',
  '19982692512000123',
  '100% secure',
  '100% Offline',
  'Offline-only audit trail',
  'sb_secret_',
  '"role":"service_role"',
  'fonts.googleapis.com',
  'test-pages',
];

const CLOUD_DISABLED_FORBIDDEN_STRINGS = [
  'Enable Cloud Sync',
  'Supabase Project URL',
  'user_vault_blobs',
  'user_sync_devices',
  'auth/v1/signup',
];

function findExecutable(candidates) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  const pngSig = '89504e470d0a1a0a';
  if (buf.subarray(0, 8).toString('hex') !== pngSig) {
    throw new Error(`Invalid PNG header: ${filePath}`);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function resolvePlaywrightPath() {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve('playwright');
  } catch {
    const npxCache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
    if (fs.existsSync(npxCache)) {
      for (const hashDir of fs.readdirSync(npxCache)) {
        const candidate = path.join(npxCache, hashDir, 'node_modules', 'playwright', 'index.js');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }
  throw new Error('Playwright not found in local node_modules or npm-cache/_npx.');
}

function auditStoreUnpacked(targetKey) {
  const cfg = TARGETS[targetKey];
  console.log(`🔎 Auditing unpacked ${cfg.name} bundle: ${cfg.unpackedDir}`);

  if (!fs.existsSync(cfg.unpackedDir)) {
    throw new Error(`Missing unpacked directory for ${targetKey}: ${cfg.unpackedDir}`);
  }
  if (fs.existsSync(path.join(cfg.unpackedDir, 'test-pages'))) {
    throw new Error(`Forbidden test-pages directory inside ${targetKey} unpacked build`);
  }

  const requiredFiles = [
    'manifest.json',
    'privacy.html',
    'dashboard.html',
    'popup.html',
    'background.js',
    'content.js',
    'content.css',
  ];
  for (const rel of requiredFiles) {
    if (!fs.existsSync(path.join(cfg.unpackedDir, rel))) {
      throw new Error(`Missing required file in ${targetKey} build: ${rel}`);
    }
  }

  const manifestText = fs.readFileSync(path.join(cfg.unpackedDir, 'manifest.json'), 'utf-8');
  if (
    manifestText.includes('test-pages') ||
    manifestText.includes('<all_urls>') ||
    manifestText.includes('127.0.0.1') ||
    manifestText.includes('localhost') ||
    manifestText.includes('"tabs"') ||
    manifestText.includes('edu.bd')
  ) {
    throw new Error(`${targetKey} manifest.json must not contain test-pages, localhost, 127.0.0.1, tabs, edu.bd, or <all_urls>.`);
  }

  const parsedManifest = JSON.parse(manifestText);
  if (parsedManifest.manifest_version !== 3) {
    throw new Error(`${targetKey} manifest_version must be 3.`);
  }

  const referencedAssets = [
    parsedManifest.background?.service_worker,
    parsedManifest.action?.default_popup,
    parsedManifest.options_page,
    ...Object.values(parsedManifest.icons || {}),
    ...Object.values(parsedManifest.action?.default_icon || {}),
    ...(parsedManifest.content_scripts || []).flatMap((cs) => [...(cs.js || []), ...(cs.css || [])]),
  ].filter(Boolean);

  for (const rel of referencedAssets) {
    if (!fs.existsSync(path.join(cfg.unpackedDir, rel))) {
      throw new Error(`${targetKey} manifest references missing file: ${rel}`);
    }
  }

  const files = walkFiles(cfg.unpackedDir);
  const findings = [];
  const activeForbiddenStrings =
    targetKey === 'chrome' && process.env.JOBFILL_ENABLE_CLOUD_SYNC === '1'
      ? FORBIDDEN_STORE_STRINGS
      : [...FORBIDDEN_STORE_STRINGS, ...CLOUD_DISABLED_FORBIDDEN_STRINGS];
  for (const file of files) {
    if (file.endsWith('.map')) {
      findings.push(`${path.relative(cfg.unpackedDir, file)} is an unintended source map`);
    }
    const ext = path.extname(file).toLowerCase();
    if (!['.js', '.html', '.json', '.css'].includes(ext)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    for (const token of activeForbiddenStrings) {
      if (content.toLowerCase().includes(token.toLowerCase())) {
        findings.push(`${path.relative(cfg.unpackedDir, file)} contains "${token}"`);
      }
    }
  }
  if (findings.length > 0) {
    throw new Error(`${targetKey} compliance audit failed:\n- ${findings.join('\n- ')}`);
  }

  console.log(`✅ ${cfg.name} unpacked audit passed (${files.length} files scanned, 0 leaks).`);
  return parsedManifest;
}

function buildZipArchive(targetKey) {
  const cfg = TARGETS[targetKey];
  fs.mkdirSync(path.dirname(cfg.zipPath), { recursive: true });
  if (fs.existsSync(cfg.zipPath)) {
    fs.unlinkSync(cfg.zipPath);
  }
  const staleDuplicate = path.resolve(ROOT, 'release', 'edge', 'JobFill-BD-Edge.zip');
  if (targetKey === 'edge' && fs.existsSync(staleDuplicate)) {
    fs.unlinkSync(staleDuplicate);
  }

  // Create deterministic POSIX forward-slash ZIP archive (never Windows '\' separators)
  const zipBuildPs = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = (Resolve-Path '${cfg.unpackedDir}').Path.TrimEnd('\\')
$dst = '${cfg.zipPath}'
if (Test-Path $dst) { Remove-Item $dst -Force }
$z = [System.IO.Compression.ZipFile]::Open($dst, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length + 1).Replace('\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $z.Dispose()
}
`;
  execFileSync('powershell', ['-NoProfile', '-Command', zipBuildPs], { stdio: 'inherit' });
  verifyZipArchive(targetKey);
}

function verifyZipArchive(targetKey) {
  const cfg = TARGETS[targetKey];
  if (!fs.existsSync(cfg.zipPath)) {
    throw new Error(`Missing ZIP archive for ${targetKey}: ${cfg.zipPath}`);
  }
  const tempExtractDir = path.join(ROOT, 'release', `.tmp-verify-zip-${targetKey}-${Date.now()}`);
  try {
    const verifyScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('${cfg.zipPath}')
try {
  $entries = $z.Entries | ForEach-Object { $_.FullName }
  if (-not ($entries -contains 'manifest.json')) { throw 'manifest.json missing directly at zip root' }
  if (-not ($entries -contains 'privacy.html')) { throw 'privacy.html missing in zip' }
  $badSlash = $entries | Where-Object { $_ -like '*\\*' }
  if ($badSlash) { throw ('ZIP contains Windows backslash path(s): ' + ($badSlash -join ', ')) }
  $forbidden = $entries | Where-Object { $_ -like '*test-pages*' -or $_ -like '*.map' -or $_ -like '*node_modules*' -or $_ -like '*.env*' }
  if ($forbidden) { throw ('Forbidden dev/secret entry in store zip: ' + ($forbidden -join ', ')) }
  Write-Output ('ZIP_VERIFIED entries=' + $entries.Count)
} finally {
  $z.Dispose()
}
[System.IO.Compression.ZipFile]::ExtractToDirectory('${cfg.zipPath}', '${tempExtractDir}')
`;
    const zipCheck = execFileSync('powershell', ['-NoProfile', '-Command', verifyScript], { encoding: 'utf-8' });

    const extractedManifestPath = path.join(tempExtractDir, 'manifest.json');
    if (!fs.existsSync(extractedManifestPath)) {
      throw new Error(`Extracted ${cfg.zipPath} is missing root manifest.json`);
    }
    const manifestObj = JSON.parse(fs.readFileSync(extractedManifestPath, 'utf-8'));
    if (manifestObj.manifest_version !== 3) {
      throw new Error(`Extracted manifest_version !== 3 in ${cfg.zipPath}`);
    }
    for (const [sizeStr, iconRel] of Object.entries(manifestObj.icons || {})) {
      const iconPath = path.join(tempExtractDir, iconRel);
      if (!fs.existsSync(iconPath)) throw new Error(`Missing extracted icon: ${iconRel}`);
      const dim = readPngDimensions(iconPath);
      const expectedSize = Number(sizeStr);
      if (dim.width !== expectedSize || dim.height !== expectedSize) {
        throw new Error(`Icon ${iconRel} dimension mismatch: expected ${expectedSize}x${expectedSize}, got ${dim.width}x${dim.height}`);
      }
    }
    for (const reqFile of ['background.js', 'content.js', 'content.css', 'dashboard.html', 'popup.html', 'privacy.html']) {
      if (!fs.existsSync(path.join(tempExtractDir, reqFile))) {
        throw new Error(`Missing extracted runtime file in ZIP: ${reqFile}`);
      }
    }

    const hash = sha256File(cfg.zipPath);
    const size = fs.statSync(cfg.zipPath).size;
    console.log(`✅ ${zipCheck.trim()} extracted_verified=true size=${size} sha256=${hash} -> ${cfg.zipPath}`);
    return { zipPath: cfg.zipPath, size, sha256: hash };
  } finally {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }
}

async function generateSharedStoreAssets(unpackedForScreenshots) {
  const browserExe = findExecutable(EDGE_EXES) || findExecutable(CHROME_EXES);
  if (!browserExe) {
    throw new Error('Neither Chrome nor Edge executable found to render store visual assets.');
  }

  console.log(`🎨 Rendering store icons, promotional tiles & 1280x800 screenshots using ${path.basename(browserExe)}...`);
  const pwPath = resolvePlaywrightPath();
  const pwMod = await import(pathToFileURL(pwPath).href);
  const chromium = pwMod.chromium || pwMod.default?.chromium;
  if (!chromium) throw new Error('Playwright chromium launcher missing.');

  fs.mkdirSync(STORE_ASSETS, { recursive: true });
  const tempUserDataDir = path.join(ROOT, 'release', `.tmp-assets-profile-${Date.now()}`);
  fs.mkdirSync(tempUserDataDir, { recursive: true });

  let context;
  const consoleErrors = [];
  const pageErrors = [];

  try {
    context = await chromium.launchPersistentContext(tempUserDataDir, {
      executablePath: browserExe,
      headless: false,
      args: [
        `--disable-extensions-except=${unpackedForScreenshots}`,
        `--load-extension=${unpackedForScreenshots}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1320,900',
      ],
    });

    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    const extId = new URL(serviceWorker.url()).host;

    const attachMonitors = (page) => {
      page.on('pageerror', (err) => pageErrors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
    };

    const logoPage = await context.newPage();
    attachMonitors(logoPage);
    await logoPage.setViewportSize({ width: 300, height: 300 });
    await logoPage.setContent(`
      <!DOCTYPE html>
      <html>
      <body style="margin:0;width:300px;height:300px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#064e3b 0%,#047857 52%,#0f172a 100%);font-family:Segoe UI,Arial,sans-serif;">
        <div style="width:248px;height:248px;border-radius:46px;background:rgba(255,255,255,0.10);border:3px solid rgba(167,243,208,0.45);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 18px 40px rgba(0,0,0,0.35);">
          <svg width="118" height="118" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="18" y="12" width="84" height="96" rx="18" fill="#ffffff" fill-opacity="0.96"/>
            <path d="M36 38H84M36 54H72M36 70H58" stroke="#065f46" stroke-width="8" stroke-linecap="round"/>
            <circle cx="84" cy="82" r="24" fill="#10b981" stroke="#064e3b" stroke-width="5"/>
            <path d="M74 82L81 89L95 75" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div style="margin-top:10px;color:#ffffff;font-weight:900;font-size:26px;letter-spacing:0.6px;">JobFill BD</div>
          <div style="color:#a7f3d0;font-weight:700;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;margin-top:2px;">SMART VAULT</div>
        </div>
      </body>
      </html>
    `);
    const logo300 = path.join(STORE_ASSETS, 'store-logo-300x300.png');
    await logoPage.screenshot({ path: logo300 });

    await logoPage.setViewportSize({ width: 128, height: 128 });
    await logoPage.setContent(`
      <!DOCTYPE html>
      <html>
      <body style="margin:0;width:128px;height:128px;display:flex;align-items:center;justify-content:center;background:transparent;">
        <div style="width:116px;height:116px;border-radius:24px;background:linear-gradient(135deg,#064e3b 0%,#047857 65%,#0f172a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid rgba(167,243,208,0.6);">
          <div style="color:#fff;font-family:Segoe UI,Arial,sans-serif;font-weight:900;font-size:38px;letter-spacing:-1px;">JB</div>
        </div>
      </body>
      </html>
    `);
    const icon128 = path.join(STORE_ASSETS, 'cws-icon-128x128.png');
    await logoPage.screenshot({ path: icon128, omitBackground: true });
    await logoPage.close();

    const dashPage = await context.newPage();
    attachMonitors(dashPage);
    await dashPage.setViewportSize({ width: 1280, height: 800 });

    await dashPage.goto(`chrome-extension://${extId}/dashboard.html?tab=circulars`, { waitUntil: 'networkidle' });
    await dashPage.waitForTimeout(700);
    const bodyTextClean = await dashPage.evaluate(() => document.body.innerText);
    for (const forbidden of ['6014157074', 'Mominpur', 'Katihara']) {
      if (bodyTextClean.includes(forbidden)) {
        throw new Error(`Leak detected on dashboard clean UI: ${forbidden}`);
      }
    }
    const shot1 = path.join(STORE_ASSETS, 'screenshot-1-circulars-1280x800.png');
    await dashPage.screenshot({ path: shot1 });

    await dashPage.goto(`chrome-extension://${extId}/dashboard.html?tab=search`, { waitUntil: 'networkidle' });
    await dashPage.waitForTimeout(600);
    const shot2 = path.join(STORE_ASSETS, 'screenshot-2-search-1280x800.png');
    await dashPage.screenshot({ path: shot2 });

    await dashPage.goto(`chrome-extension://${extId}/dashboard.html?tab=security`, { waitUntil: 'networkidle' });
    await dashPage.waitForTimeout(600);
    const shot3 = path.join(STORE_ASSETS, 'screenshot-3-vault-1280x800.png');
    await dashPage.screenshot({ path: shot3 });

    const popupPage = await context.newPage();
    attachMonitors(popupPage);
    await popupPage.setViewportSize({ width: 390, height: 560 });
    await popupPage.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'networkidle' });
    await popupPage.waitForTimeout(500);
    const popupPng = await popupPage.screenshot();
    await popupPage.close();

    await dashPage.setViewportSize({ width: 1280, height: 800 });
    await dashPage.setContent(`
      <!DOCTYPE html>
      <html>
      <body style="margin:0;width:1280px;height:800px;background:linear-gradient(135deg,#0f172a 0%,#064e3b 55%,#047857 100%);font-family:Segoe UI,Arial,sans-serif;display:flex;align-items:center;justify-content:center;gap:56px;color:#fff;">
        <div style="max-width:480px;">
          <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(16,185,129,0.2);border:1px solid rgba(167,243,208,0.45);color:#a7f3d0;font-size:13px;font-weight:700;margin-bottom:16px;">Manifest V3 • Local Encrypted Vault</div>
          <h1 style="margin:0 0 14px;font-size:40px;line-height:1.15;font-weight:900;">Smart One-Click Autofill Popup</h1>
          <p style="margin:0;font-size:18px;line-height:1.55;color:#d1fae5;">Review matched fields, jump to Circulars &amp; Job Search, and stay protected with automatic exclusions on Google Meet &amp; Zoom.</p>
        </div>
        <div style="background:#ffffff;border-radius:20px;padding:10px;box-shadow:0 28px 70px rgba(0,0,0,0.45);">
          <img src="data:image/png;base64,${popupPng.toString('base64')}" style="display:block;width:390px;border-radius:12px;" />
        </div>
      </body>
      </html>
    `);
    const shot4 = path.join(STORE_ASSETS, 'screenshot-4-popup-1280x800.png');
    await dashPage.screenshot({ path: shot4 });

    await dashPage.setViewportSize({ width: 440, height: 280 });
    await dashPage.setContent(`
      <!DOCTYPE html>
      <html>
      <body style="margin:0;width:440px;height:280px;background:linear-gradient(135deg,#064e3b 0%,#047857 60%,#0f172a 100%);font-family:Segoe UI,Arial,sans-serif;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:24px 28px;box-sizing:border-box;">
        <div style="max-width:255px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:#a7f3d0;text-transform:uppercase;margin-bottom:6px;">Local AES-256 Vault</div>
          <div style="font-size:28px;font-weight:900;line-height:1.1;margin-bottom:8px;">JobFill BD</div>
          <div style="font-size:13px;line-height:1.45;color:#d1fae5;">Smart job application autofill &amp; circular hub for Bangladesh.</div>
        </div>
        <div style="width:96px;height:96px;border-radius:24px;background:rgba(255,255,255,0.14);border:2px solid rgba(167,243,208,0.45);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:34px;color:#fff;">JB</div>
      </body>
      </html>
    `);
    const promoSmall = path.join(STORE_ASSETS, 'promo-small-440x280.png');
    await dashPage.screenshot({ path: promoSmall });

    await dashPage.setViewportSize({ width: 1400, height: 560 });
    await dashPage.setContent(`
      <!DOCTYPE html>
      <html>
      <body style="margin:0;width:1400px;height:560px;background:linear-gradient(135deg,#0f172a 0%,#064e3b 55%,#047857 100%);font-family:Segoe UI,Arial,sans-serif;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:56px 88px;box-sizing:border-box;">
        <div style="max-width:680px;">
          <div style="display:inline-block;background:rgba(16,185,129,0.22);border:1px solid rgba(167,243,208,0.45);color:#a7f3d0;font-weight:700;font-size:14px;padding:6px 14px;border-radius:999px;margin-bottom:18px;">Privacy-First Job Application Assistant</div>
          <div style="font-size:54px;font-weight:900;line-height:1.12;margin-bottom:16px;">JobFill BD</div>
          <div style="font-size:22px;line-height:1.5;color:#d1fae5;">Official job circular discovery, deadline alerts, and smart autofill backed by your locally encrypted browser vault.</div>
        </div>
        <div style="background:#ffffff;padding:12px;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,0.42);">
          <img src="data:image/png;base64,${popupPng.toString('base64')}" style="display:block;width:300px;border-radius:12px;" />
        </div>
      </body>
      </html>
    `);
    const promoLarge = path.join(STORE_ASSETS, 'promo-large-1400x560.png');
    await dashPage.screenshot({ path: promoLarge });
    await dashPage.close();

    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      throw new Error(`Runtime errors during visual asset capture:\nPageErrors: ${JSON.stringify(pageErrors)}\nConsoleErrors: ${JSON.stringify(consoleErrors)}`);
    }
  } finally {
    if (context) await context.close().catch(() => {});
    fs.rmSync(tempUserDataDir, { recursive: true, force: true });
  }
}

function validateStoreAssets() {
  const expectedDims = [
    ['store-logo-300x300.png', 300, 300],
    ['cws-icon-128x128.png', 128, 128],
    ['promo-small-440x280.png', 440, 280],
    ['promo-large-1400x560.png', 1400, 560],
    ['screenshot-1-circulars-1280x800.png', 1280, 800],
    ['screenshot-2-search-1280x800.png', 1280, 800],
    ['screenshot-3-vault-1280x800.png', 1280, 800],
    ['screenshot-4-popup-1280x800.png', 1280, 800],
  ];
  for (const [file, w, h] of expectedDims) {
    const p = path.join(STORE_ASSETS, file);
    if (!fs.existsSync(p)) throw new Error(`Missing store visual asset: ${p}`);
    const d = readPngDimensions(p);
    if (d.width !== w || d.height !== h) {
      throw new Error(`Asset ${file} expected ${w}x${h}, got ${d.width}x${d.height}`);
    }
  }
  console.log('✅ Verified all store visual asset dimensions cleanly.');
}

function writeSubmissionDocsAndChecksums(zipRecords) {
  fs.mkdirSync(STORE_ASSETS, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'privacy.html'), path.join(STORE_ASSETS, 'privacy-policy.html'));

  const sharedCopy = `
NAME: JobFill BD
VERSION: 2.0.0
PUBLISHER: MR Software Studio
SUPPORT EMAIL: mahfuzar148@gmail.com
PRIVACY POLICY URL: https://mahfuzar148.github.io/jobfill-bd-privacy/
PRIMARY CATEGORY: Productivity
LOCAL-ONLY TESTING NOTE: No account required. Reviewers can create a local profile ("My Job Profile") immediately in the Dashboard and test autofill/job circulars offline or online. Across ALL v2.0.0 first-release packages (__JOBFILL_CLOUD_SYNC_DISABLED__=true), Cloud Sync and user accounts are disabled and eliminated at compile time, so all personal profiles, education/employment records, documents, bookmarks, and autofill history stay strictly local on device; public job circular retrieval requires Internet access via read-only GET requests (credentials: 'omit', zero PII).
PERMISSION JUSTIFICATIONS:
- storage: Saves extension preferences, vault salt/timeout metadata, and local selector fingerprints.
- activeTab & scripting: Scans/fills forms on supported recruitment pages or custom sites explicitly permitted by the user, while strictly excluding Google Meet, Zoom, and Google Auth/Mail/Drive/Docs.
- alarms & notifications: Runs MV3 daily circular checks and local deadline reminder notifications cleanly.
- host_permissions & optional_host_permissions: Read-only public circular GETs (credentials: 'omit', zero PII) and explicit user-approved recruitment portal form filling (including legacy http://*.teletalk.com.bd and http://*.gov.bd portals with explicit sensitive-field HTTP warnings). Broad "tabs" ("Read your browsing history") permission and unused ".edu.bd" wildcard are intentionally omitted.
`.trim();

  fs.writeFileSync(
    path.join(STORE_ASSETS, 'CHROME_STORE_SUBMISSION_CHECKLIST.txt'),
    `JOBFILL BD — GOOGLE CHROME WEB STORE SUBMISSION CHECKLIST
ZIP: release/chrome/JobFill-BD-Chrome.zip
HOSTED PRIVACY POLICY: https://mahfuzar148.github.io/jobfill-bd-privacy/
ASSETS:
- Store Icon: release/assets/cws-icon-128x128.png (128x128)
- Small Promo: release/assets/promo-small-440x280.png (440x280)
- Marquee Promo: release/assets/promo-large-1400x560.png (1400x560)
- Screenshots (1280x800): screenshot-1..4 in release/assets/

${sharedCopy}
`,
    'utf-8'
  );

  fs.writeFileSync(
    path.join(STORE_ASSETS, 'EDGE_STORE_SUBMISSION_CHECKLIST.txt'),
    `JOBFILL BD — MICROSOFT EDGE ADD-ONS STORE SUBMISSION CHECKLIST
ZIP: release/JobFill-BD-Edge.zip
HOSTED PRIVACY POLICY: https://mahfuzar148.github.io/jobfill-bd-privacy/
ASSETS:
- Store Logo: release/assets/store-logo-300x300.png (300x300)
- Small Promo: release/assets/promo-small-440x280.png (440x280)
- Large Promo: release/assets/promo-large-1400x560.png (1400x560)
- Screenshots (1280x800): screenshot-1..4 in release/assets/

${sharedCopy}
`,
    'utf-8'
  );

  const lines = zipRecords.map(
    (rec) => `${rec.sha256}  ${path.relative(ROOT, rec.zipPath).replace(/\\/g, '/')}  (${rec.size} bytes)`
  );
  fs.writeFileSync(path.join(STORE_ASSETS, 'CHECKSUMS.sha256'), lines.join('\n') + '\n', 'utf-8');
  console.log(`✅ Store checklists and CHECKSUMS.sha256 written under ${STORE_ASSETS}`);
}

async function main() {
  const activeTargets = TARGET_ARG === 'both' ? ['chrome', 'edge'] : [TARGET_ARG];
  if (!activeTargets.every((t) => TARGETS[t])) {
    throw new Error(`Unknown --target value "${TARGET_ARG}". Expected chrome, edge, or both.`);
  }

  if (VALIDATE_ONLY) {
    console.log('🛡️ Running validation across store bundles, manifests, ZIPs & assets...');
    const manifests = {};
    const zipRecords = [];
    for (const key of ['chrome', 'edge']) {
      if (fs.existsSync(TARGETS[key].unpackedDir) || fs.existsSync(TARGETS[key].zipPath)) {
        manifests[key] = auditStoreUnpacked(key);
        zipRecords.push(verifyZipArchive(key));
      } else {
        throw new Error(`Store target "${key}" not built yet. Run "npm run build:stores" first.`);
      }
    }
    if (manifests.chrome && manifests.edge) {
      if (JSON.stringify(manifests.chrome) !== JSON.stringify(manifests.edge)) {
        throw new Error('Manifest parity mismatch between Chrome and Edge unpacked store builds!');
      }
      console.log('✅ Verified identical MV3 manifest & permission parity between Chrome and Edge store builds.');
    }
    validateStoreAssets();
    console.log('🎉 validate:stores passed with ZERO errors!');
    return;
  }

  for (const key of activeTargets) {
    const cfg = TARGETS[key];
    console.log(`📦 Building clean ${cfg.name} bundle...`);
    const res = spawnSync(process.execPath, ['build.js', cfg.buildFlag], { cwd: ROOT, stdio: 'inherit' });
    if (res.status !== 0) {
      throw new Error(`Build failed for ${key} with exit code ${res.status}`);
    }
    auditStoreUnpacked(key);
  }

  await generateSharedStoreAssets(TARGETS[activeTargets[0]].unpackedDir);
  validateStoreAssets();

  const zipRecords = [];
  for (const key of ['chrome', 'edge']) {
    if (activeTargets.includes(key) || fs.existsSync(TARGETS[key].unpackedDir)) {
      if (activeTargets.includes(key)) {
        buildZipArchive(key);
      }
      zipRecords.push(verifyZipArchive(key));
    }
  }

  writeSubmissionDocsAndChecksums(zipRecords);
  console.log('🎉 Cross-browser Chrome + Edge store packaging complete!');
}

main().catch((err) => {
  console.error('❌ Store packager failed:', err);
  process.exit(1);
});
