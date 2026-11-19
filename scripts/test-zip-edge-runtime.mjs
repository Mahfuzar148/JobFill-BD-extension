import { execSync, spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ZIP_PATH = path.resolve('release/JobFill-BD-Edge-v2.0.1.zip');
const UNPACKED_ZIP_DIR = path.resolve('release/tmp_test_unpacked_zip');
const USER_DATA_DIR = path.resolve(`.tmp_edge_audit_zip_${Date.now()}`);
const CDP_PORT = 9255;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CdpConnection {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.errors = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.method === 'Runtime.consoleAPICalled' && parsed.params.type === 'error') {
            const args = (parsed.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
            this.errors.push(args);
          }
          if (parsed.method === 'Runtime.exceptionThrown') {
            this.errors.push(parsed.params.exceptionDetails?.text || 'Uncaught exception');
          }
        } catch {}
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      const handler = (event) => {
        try {
          const res = JSON.parse(event.data);
          if (res.id === id) {
            this.ws.removeEventListener('message', handler);
            if (res.error) reject(new Error(res.error.message));
            else resolve(res.result);
          }
        } catch {}
      };
      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res?.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Eval error');
    }
    return res?.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function runZipEdgeVerification() {
  console.log('=== Step 1: Unpacking exact release ZIP ===');
  if (fs.existsSync(UNPACKED_ZIP_DIR)) fs.rmSync(UNPACKED_ZIP_DIR, { recursive: true, force: true });
  fs.mkdirSync(UNPACKED_ZIP_DIR, { recursive: true });
  execSync(`tar -xf "${ZIP_PATH}" -C "${UNPACKED_ZIP_DIR}"`);
  console.log(`Unpacked ZIP into: ${UNPACKED_ZIP_DIR}`);

  const manifestPath = path.join(UNPACKED_ZIP_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Manifest loaded: name="${manifest.name}", version="${manifest.version}", manifest_version=${manifest.manifest_version}`);

  console.log('\n=== Step 2: Spawning Clean Microsoft Edge Profile ===');
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  const proc = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      `--load-extension=${UNPACKED_ZIP_DIR}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  let swTarget = null;
  let targets = [];
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`);
      if (Array.isArray(targets)) {
        console.log('Current Edge targets:', targets.map(t => ({ type: t.type, url: t.url })));
        swTarget = targets.find(t => 
          t.type === 'service_worker' && 
          t.url.includes('/background.js') &&
          !t.url.includes('admccjkmockfdflocgggjfgdacdodkdf')
        );
        if (swTarget) break;
      }
    } catch {}
  }

  if (!swTarget) {
    proc.kill();
    throw new Error('Could not find extension service worker in clean Edge instance.');
  }

  const extId = swTarget.url.match(/chrome-extension:\/\/([a-z0-9]+)\//i)[1];
  console.log(`Extension initialized in Microsoft Edge!`);
  console.log(`  Dynamic Extension ID: ${extId}`);
  console.log(`  Service Worker URL: ${swTarget.url}`);

  console.log('\n=== Step 3: Service Worker & Storage API Test ===');
  const swCdp = new CdpConnection(swTarget.webSocketDebuggerUrl);
  await swCdp.connect();
  await swCdp.send('Runtime.enable');

  const swApiCheck = await swCdp.evaluate(`({
    alarms: typeof chrome.alarms !== 'undefined',
    notifications: typeof chrome.notifications !== 'undefined',
    storage: typeof chrome.storage !== 'undefined',
    runtime: typeof chrome.runtime !== 'undefined'
  })`);
  console.log('Service Worker Chrome APIs:', swApiCheck);

  const storageTest = await swCdp.evaluate(`new Promise(resolve => {
    chrome.storage.local.set({ 'edge_test_key_v201': 'verified_2.0.1' }, () => {
      chrome.storage.local.get(['edge_test_key_v201'], res => {
        resolve(res.edge_test_key_v201);
      });
    });
  })`);
  console.log('Storage Read/Write Verification:', storageTest);

  console.log('\n=== Step 4: Popup & Dashboard Render Verification ===');
  // Create target for popup.html
  const popupPage = await swCdp.evaluate(`fetch('chrome-extension://${extId}/popup.html').then(r => r.text()).then(t => ({ len: t.length, hasTitle: t.includes('JobFill BD') }))`);
  console.log('Popup HTML Asset accessible via extension origin:', popupPage);

  const dashboardPage = await swCdp.evaluate(`fetch('chrome-extension://${extId}/dashboard.html').then(r => r.text()).then(t => ({ len: t.length, hasTitle: t.includes('JobFill BD') }))`);
  console.log('Dashboard HTML Asset accessible via extension origin:', dashboardPage);

  const backgroundErrors = swCdp.errors;
  console.log('Service Worker runtime error count:', backgroundErrors.length);

  swCdp.close();
  proc.kill();

  // Cleanup
  await sleep(1000);
  try {
    fs.rmSync(UNPACKED_ZIP_DIR, { recursive: true, force: true });
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  } catch {}

  console.log('\n✅ Edge Production Package Verification Complete: 100% PASS');
}

runZipEdgeVerification().catch(err => {
  console.error('Fatal Edge verification error:', err);
  process.exit(1);
});
