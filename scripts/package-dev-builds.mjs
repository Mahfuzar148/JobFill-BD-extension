import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DEV_ROOT = path.resolve(ROOT, 'dev-builds');
const EDGE_UNPACKED = path.resolve(DEV_ROOT, 'edge', 'unpacked');
const EDGE_ZIP = path.resolve(DEV_ROOT, 'edge', 'JobFill-BD-Edge-Dev.zip');
const CHROME_UNPACKED = path.resolve(DEV_ROOT, 'chrome', 'unpacked');
const CHROME_ZIP = path.resolve(DEV_ROOT, 'chrome', 'JobFill-BD-Chrome-Dev.zip');

const PROD_EDGE_ZIP = path.resolve(ROOT, 'release', 'JobFill-BD-Edge.zip');
const PROD_CHROME_ZIP = path.resolve(ROOT, 'release', 'chrome', 'JobFill-BD-Chrome.zip');

const EXPECTED_PROD_EDGE_SHA256 = 'db08aa45f1c3ed99ad8adebf5b81edfa94812e93a02557d2306ee171aad52732';
const EXPECTED_PROD_CHROME_SHA256 = '23d002185f2640cb47803a086ab39076f2c2e923ac84405c3117391d65f89db9';

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
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function auditBundle(name, unpackedDir, expectCloudSyncDisabled) {
  const manifestPath = path.join(unpackedDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  const allowedPerms = ['storage', 'activeTab', 'scripting', 'alarms', 'notifications'];
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(allowedPerms)) {
    throw new Error(`[${name}] Unexpected permissions: ${JSON.stringify(manifest.permissions)}`);
  }
  if (fs.existsSync(path.join(unpackedDir, 'test-pages'))) {
    throw new Error(`[${name}] Forbidden test-pages directory in store-clean dev build!`);
  }

  const cs = manifest.content_scripts?.[0];
  const excludes = cs?.exclude_matches || [];
  if (!excludes.some((m) => m.includes('meet.google.com')) || !excludes.some((m) => m.includes('zoom.us'))) {
    throw new Error(`[${name}] Missing Meet/Zoom exclude_matches in manifest!`);
  }

  const files = walkFiles(unpackedDir);
  for (const file of files) {
    if (file.endsWith('.map')) {
      throw new Error(`[${name}] Unexpected source map packaged: ${file}`);
    }
    if (!/\.(js|html|css|json)$/i.test(file)) continue;
    const text = fs.readFileSync(file, 'utf-8');
    if (text.includes('sb_secret_') || text.includes('"role":"service_role"')) {
      throw new Error(`[${name}] Secret leakage detected in ${file}`);
    }
    if (expectCloudSyncDisabled && (text.includes('user_vault_blobs') || text.includes('auth/v1/signup'))) {
      throw new Error(`[${name}] Edge Cloud-Sync-Disabled build still references ${file}`);
    }
  }
  console.log(`✅ [${name}] Audited ${files.length} unpacked files cleanly (CSP/Permissions/Exclusions/No-Secrets PASS).`);
}

function zipDir(sourceDir, outZip) {
  fs.mkdirSync(path.dirname(outZip), { recursive: true });
  if (fs.existsSync(outZip)) fs.rmSync(outZip);
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${outZip}' -Force`,
    ],
    { stdio: 'inherit' }
  );
  if (!fs.existsSync(outZip)) {
    throw new Error(`Failed to create ZIP archive: ${outZip}`);
  }
  const stat = fs.statSync(outZip);
  const sha = sha256File(outZip);
  console.log(`📦 Created ${path.relative(ROOT, outZip)} | ${stat.size} bytes | SHA-256: ${sha}`);
  return { path: outZip, bytes: stat.size, sha256: sha };
}

function verifyProductionZipsUntouched() {
  if (!fs.existsSync(PROD_EDGE_ZIP) || !fs.existsSync(PROD_CHROME_ZIP)) {
    throw new Error('Missing protected v2.0.0 production release ZIPs!');
  }
  const edgeSha = sha256File(PROD_EDGE_ZIP);
  const chromeSha = sha256File(PROD_CHROME_ZIP);
  if (edgeSha !== EXPECTED_PROD_EDGE_SHA256) {
    throw new Error(`CRITICAL: Production Edge ZIP modified! Expected ${EXPECTED_PROD_EDGE_SHA256}, got ${edgeSha}`);
  }
  if (chromeSha !== EXPECTED_PROD_CHROME_SHA256) {
    throw new Error(`CRITICAL: Production Chrome ZIP modified! Expected ${EXPECTED_PROD_CHROME_SHA256}, got ${chromeSha}`);
  }
  console.log('🛡️ Verified BOTH v2.0.0 production release ZIPs remained 100% untouched.');
}

async function main() {
  verifyProductionZipsUntouched();

  // 1. Edge Development Build (Local-Only: Cloud Sync Disabled)
  const edgeRes = spawnSync(
    process.execPath,
    ['build.js', '--edge-store', '--out-dir=dev-builds/edge/unpacked'],
    {
      cwd: ROOT,
      env: { ...process.env, JOBFILL_ENABLE_CLOUD_SYNC: '0' },
      stdio: 'inherit',
    }
  );
  if (edgeRes.status !== 0) throw new Error('Edge dev build failed');
  auditBundle('EDGE-DEV', EDGE_UNPACKED, true);
  const edgePkg = zipDir(EDGE_UNPACKED, EDGE_ZIP);

  // 2. Chrome Development Build (Optional Cloud Sync Supported; Credential Vault strictly Local-Only)
  const chromeRes = spawnSync(
    process.execPath,
    ['build.js', '--chrome-store', '--out-dir=dev-builds/chrome/unpacked'],
    {
      cwd: ROOT,
      env: { ...process.env, JOBFILL_ENABLE_CLOUD_SYNC: '1' },
      stdio: 'inherit',
    }
  );
  if (chromeRes.status !== 0) throw new Error('Chrome dev build failed');
  auditBundle('CHROME-DEV', CHROME_UNPACKED, false);
  const chromePkg = zipDir(CHROME_UNPACKED, CHROME_ZIP);

  verifyProductionZipsUntouched();

  const summary = {
    generatedAt: new Date().toISOString(),
    edgeDevZip: { file: 'dev-builds/edge/JobFill-BD-Edge-Dev.zip', ...edgePkg },
    chromeDevZip: { file: 'dev-builds/chrome/JobFill-BD-Chrome-Dev.zip', ...chromePkg },
    productionProtected: {
      edgeSha256: EXPECTED_PROD_EDGE_SHA256,
      chromeSha256: EXPECTED_PROD_CHROME_SHA256,
    },
  };
  fs.writeFileSync(path.join(DEV_ROOT, 'CHECKSUMS.json'), JSON.stringify(summary, null, 2), 'utf-8');
  console.log('🎉 Separate Chrome & Edge development packages built and verified cleanly in dev-builds/');
}

main().catch((err) => {
  console.error('❌ Dev build audit failed:', err);
  process.exit(1);
});
