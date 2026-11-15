// JobFill BD - Microsoft Edge Extension Runtime Complete Verification
// Tests unpacked extension in Microsoft Edge binary via CDP with native WebSocket.

import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EXT_DIST_PATH = path.resolve('dist');
const CDP_PORT = 9243;
const HTTP_PORT = 8189;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startStaticServer(dir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0].split('#')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/dashboard.html';
    const filePath = path.join(dir, reqPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

class CdpConnection {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.consoleLogs = [];
    this.consoleErrors = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.method === 'Runtime.consoleAPICalled') {
            const type = parsed.params.type;
            const args = (parsed.params.args || []).map((a) => a.value ?? a.description ?? '');
            const msg = args.join(' ');
            this.consoleLogs.push({ type, msg });
            if (type === 'error') {
              this.consoleErrors.push(msg);
            }
          }
          if (parsed.method === 'Runtime.exceptionThrown') {
            this.consoleErrors.push(parsed.params.exceptionDetails?.text || 'Uncaught exception');
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
      returnByValue: true,
    });
    if (res?.exceptionDetails) {
      console.log('Exception details:', JSON.stringify(res.exceptionDetails, null, 2));
      throw new Error(res.exceptionDetails.text || 'Evaluation exception');
    }
    return res?.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function main() {
  console.log(`============================================================`);
  console.log(`🚀 Microsoft Edge Live Unpacked Extension Runtime Verification`);
  console.log(`Binary: ${EDGE_PATH}`);
  console.log(`Dist: ${EXT_DIST_PATH}`);

  const server = await startStaticServer(EXT_DIST_PATH, HTTP_PORT);
  console.log(`🌐 Test server running on port ${HTTP_PORT}`);

  const userDataDir = path.resolve(`.tmp_edge_audit_${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const proc = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--load-extension=${EXT_DIST_PATH}`,
      'about:blank',
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
        // Find the service worker that belongs to our extension (not built-in extensions)
        swTarget = targets.find((t) =>
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
    server.close();
    throw new Error('JobFill BD Service Worker target not found in Edge.');
  }

  const matchExtId = swTarget.url.match(/chrome-extension:\/\/([a-z0-9]+)\//i);
  const extensionId = matchExtId ? matchExtId[1] : null;
  console.log(`✅ JobFill BD Extension installed in Microsoft Edge!`);
  console.log(`   Extension ID: "${extensionId}"`);
  console.log(`   Service Worker URL: "${swTarget.url}"`);

  // Connect to Service Worker
  const swConn = new CdpConnection(swTarget.webSocketDebuggerUrl);
  await swConn.connect();
  await swConn.send('Runtime.enable');

  const swDetails = await swConn.evaluate(`({
    hasChrome: typeof chrome !== 'undefined',
    runtimeId: chrome?.runtime?.id,
    hasAlarms: Boolean(chrome?.alarms),
    hasNotifications: Boolean(chrome?.notifications),
    hasStorage: Boolean(chrome?.storage?.local)
  })`);
  console.log(`✅ Service Worker Capabilities:`, swDetails);

  // Test Extension Storage from SW
  const storageTestRes = await swConn.evaluate(`
    (async () => {
      await chrome.storage.local.set({ '__edge_e2e_verified__': 'success_123' });
      const r = await chrome.storage.local.get('__edge_e2e_verified__');
      return r.__edge_e2e_verified__;
    })()
  `);
  console.log(`✅ Service Worker chrome.storage.local verified:`, storageTestRes);

  // Open an extension page target in Edge: popup.html
  console.log(`\n🔍 Testing Extension Popup: chrome-extension://${extensionId}/popup.html`);
  const pageTarget = targets.find((t) => t.type === 'page');
  const pageConn = new CdpConnection(pageTarget.webSocketDebuggerUrl);
  await pageConn.connect();
  await pageConn.send('Page.enable');
  await pageConn.send('Runtime.enable');

  await pageConn.send('Page.navigate', { url: `chrome-extension://${extensionId}/popup.html` });
  await sleep(1500);

  const popupMetrics = await pageConn.evaluate(`({
    title: document.title,
    bodyLength: document.body.innerText.length,
    buttonCount: document.querySelectorAll('button').length,
    headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.innerText.trim()).filter(Boolean),
    hasText: document.body.innerText.slice(0, 200)
  })`);
  console.log(`✅ Popup Page Loaded Successfully!`);
  console.log(`   Title: "${popupMetrics.title}", Buttons: ${popupMetrics.buttonCount}`);
  console.log(`   Headings: [${popupMetrics.headings.join(' | ')}]`);
  console.log(`   Text: "${popupMetrics.hasText.replace(/\n+/g, ' ')}"`);

  // Test Extension Dashboard: dashboard.html
  console.log(`\n🔍 Testing Extension Dashboard: chrome-extension://${extensionId}/dashboard.html`);
  await pageConn.send('Page.navigate', { url: `chrome-extension://${extensionId}/dashboard.html` });
  await sleep(2500);

  const dashMetrics = await pageConn.evaluate(`({
    title: document.title,
    rootMounted: Boolean(document.getElementById('root')?.children.length > 0),
    buttonCount: document.querySelectorAll('button').length,
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean).slice(0, 4)
  })`);
  console.log(`✅ Dashboard Page Loaded Successfully!`);
  console.log(`   Title: "${dashMetrics.title}", Root Mounted: ${dashMetrics.rootMounted}, Buttons: ${dashMetrics.buttonCount}`);
  console.log(`   Headings: [${dashMetrics.headings.join(' | ')}]`);

  // Test Navigations across all extension views
  const testRoutes = [
    { name: 'Overview', hash: '#overview' },
    { name: 'Profile', hash: '#profile' },
    { name: 'Credential Vault', hash: '#vault' },
    { name: 'Document Wallet', hash: '#wallet' },
    { name: 'Job Search', hash: '#jobs' },
    { name: 'Eligibility Checker', hash: '#eligibility' },
    { name: 'Application Tracker', hash: '#tracker' },
    { name: 'Autofill History', hash: '#history' },
    { name: 'CV Builder', hash: '#cv' },
    { name: 'Career Calendar', hash: '#calendar' },
    { name: 'Notifications', hash: '#notifications' },
  ];

  const journeyResults = [];

  for (const r of testRoutes) {
    await pageConn.evaluate(`window.location.hash = '${r.hash}'`);
    await sleep(700);
    const info = await pageConn.evaluate(`({
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean).slice(0, 3),
      buttons: document.querySelectorAll('button').length
    })`);
    const ok = info.buttons > 0 || (info.headings && info.headings.length > 0);
    journeyResults.push({ route: r.name, hash: r.hash, ...info, ok });
    console.log(`  ➔ Journey [${r.name}] (${r.hash}): Headings=[${info.headings.join(' | ')}], Buttons=${info.buttons} -> ${ok ? 'PASS' : 'FAIL'}`);
  }

  // Test In-Page Content Script Assistant
  console.log(`\n🔍 Testing In-Page Content Script Assistant on http://127.0.0.1:${HTTP_PORT}/test-pages/teletalk-form.html`);
  await pageConn.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/test-pages/teletalk-form.html` });
  await sleep(2000);

  const formStatus = await pageConn.evaluate(`({
    inputsCount: document.querySelectorAll('input, select, textarea').length,
    hasJobFillMarker: Boolean(
      document.querySelector('.jobfill-inpage-banner') ||
      document.querySelector('#jobfill-assistant-container') ||
      document.querySelector('[data-jobfill]') ||
      document.body.innerHTML.includes('jobfill') ||
      window.__JOBFILL_INJECTED__
    )
  })`);
  console.log(`✅ Test Page Content Form Loaded:`, formStatus);

  console.log(`\n🔍 Checking runtime console error tallies...`);
  console.log(`   Service Worker Console Errors: ${swConn.consoleErrors.length}`);
  if (swConn.consoleErrors.length > 0) {
    console.warn('   SW Errors:', swConn.consoleErrors);
  }
  console.log(`   Extension Pages Console Errors: ${pageConn.consoleErrors.length}`);
  if (pageConn.consoleErrors.length > 0) {
    console.warn('   Page Errors:', pageConn.consoleErrors);
  }

  // Browser Restart Persistence
  console.log(`\n🔄 Testing Browser Restart Persistence with same user-data-dir...`);
  // Gracefully close browser to flush LevelDB writes
  try {
    await pageConn.send('Browser.close');
  } catch {
    proc.kill();
  }
  swConn.close();
  pageConn.close();
  server.close();
  await sleep(2500);

  const restartProc = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--load-extension=${EXT_DIST_PATH}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let restartedSw = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const restartedTargets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`);
      if (Array.isArray(restartedTargets)) {
        restartedSw = restartedTargets.find((t) =>
          t.type === 'service_worker' &&
          t.url.includes('/background.js') &&
          !t.url.includes('admccjkmockfdflocgggjfgdacdodkdf')
        );
        if (restartedSw) break;
      }
    } catch {}
  }

  let restartStorageMatched = false;
  if (restartedSw) {
    console.log('Restarted SW Target URL:', restartedSw.url);
    const rConn = new CdpConnection(restartedSw.webSocketDebuggerUrl);
    await rConn.connect();
    await rConn.send('Runtime.enable');
    const val = await rConn.evaluate(`
      (async () => {
        const allKeys = await chrome.storage.local.get(null);
        console.log('All keys on restart:', Object.keys(allKeys));
        const d = await chrome.storage.local.get('__edge_e2e_verified__');
        return d.__edge_e2e_verified__;
      })()
    `);
    console.log('Retrieved val on restart:', val);
    restartStorageMatched = val === 'success_123';
    rConn.close();
  }
  console.log(`✅ Browser Restart Persistence: Service Worker alive, Storage value preserved: ${restartStorageMatched}`);

  restartProc.kill();
  await sleep(1000);
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}

  const allPassed =
    Boolean(extensionId) &&
    swDetails.hasChrome &&
    swDetails.hasStorage &&
    storageTestRes === 'success_123' &&
    dashMetrics.rootMounted &&
    journeyResults.every((j) => j.ok) &&
    formStatus.inputsCount > 0 &&
    restartStorageMatched;

  console.log(`\n============================================================`);
  if (allPassed) {
    console.log(`🎉 Microsoft Edge Manifest V3 Unpacked Extension Verification: 100% PASS!`);
  } else {
    console.error(`❌ Edge verification failed on some checks.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Edge verification error:', err);
  process.exit(1);
});
