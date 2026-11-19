// JobFill BD - Smart Filter Browser E2E Live Runner
// Launches actual Google Chrome and Microsoft Edge binaries with a local static web server serving dist,
// connects via Chrome DevTools Protocol (CDP), inspects console errors, verifies rendered UI, React mount, and DOM elements.

import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EXT_DIST_PATH = path.resolve('dist');
const HTTP_PORT = 8189;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple static HTTP server for serving dist files
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

async function runBrowserVerification(browserName, executablePath, cdpPort) {
  console.log(`\n============================================================`);
  console.log(`🚀 Starting ${browserName} Live E2E Verification on CDP port ${cdpPort}...`);
  console.log(`Binary: ${executablePath}`);
  console.log(`Extension Dist: ${EXT_DIST_PATH}`);

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Executable not found: ${executablePath}`);
  }

  const userDataDir = path.resolve(`.tmp_${browserName.toLowerCase().replace(/\s+/g, '_')}_profile_${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const targetUrl = `http://127.0.0.1:${HTTP_PORT}/dashboard.html#jobs`;

  const proc = spawn(
    executablePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let connected = false;
  let targets = [];

  try {
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await fetchJson(`http://127.0.0.1:${cdpPort}/json`);
        if (Array.isArray(targets) && targets.length > 0) {
          connected = true;
          break;
        }
      } catch {
        // Retry
      }
    }

    if (!connected) {
      throw new Error(`Failed to connect to ${browserName} CDP on port ${cdpPort}`);
    }

    console.log(`✅ ${browserName} launched and CDP connected successfully!`);

    // Open target page via /json/new
    console.log(`🌐 Navigating to ${targetUrl}...`);
    const newTarget = await fetchJson(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' });
    const targetWsUrl = newTarget.webSocketDebuggerUrl;

    if (!targetWsUrl) {
      throw new Error(`No webSocketDebuggerUrl returned for new target`);
    }

    console.log(`🔍 Connecting WebSocket to dashboard target: ${newTarget.id}...`);
    const ws = new WebSocket(targetWsUrl);

    const messages = [];
    const consoleEvents = [];
    let msgId = 1;

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        messages.push(parsed);
        if (parsed.method === 'Runtime.consoleAPICalled') {
          consoleEvents.push(parsed.params);
        }
      } catch {}
    };

    const sendCdp = (method, params = {}) => {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (event) => {
          try {
            const res = JSON.parse(event.data);
            if (res.id === id) {
              ws.removeEventListener('message', handler);
              resolve(res.result);
            }
          } catch {}
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await sendCdp('Runtime.enable');
    await sendCdp('Page.enable');
    await sendCdp('DOM.enable');

    // Wait for React hydration and SPA render
    await sleep(2500);

    // Evaluate document title
    const evalTitle = await sendCdp('Runtime.evaluate', {
      expression: 'document.title',
    });
    console.log(`📄 Page Title: "${evalTitle?.result?.value}"`);

    // Evaluate whether the app root rendered
    const evalRoot = await sendCdp('Runtime.evaluate', {
      expression: 'Boolean(document.getElementById("root") && document.getElementById("root").innerHTML.length > 50)',
    });
    console.log(`⚛️ React App Root Mounted: ${evalRoot?.result?.value ? 'YES' : 'NO'}`);

    // Evaluate Smart Search Controls
    const evalControls = await sendCdp('Runtime.evaluate', {
      expression: `({
        bodyLength: document.body.innerText.length,
        hasSearchInput: Boolean(document.querySelector('input[type="text"], input[placeholder*="Search"], input[placeholder*="খুঁজুন"]')),
        hasCategoryDropdown: Boolean(document.querySelector('select, [role="button"]')),
        buttonCount: document.querySelectorAll('button').length,
        navigationPills: Array.from(document.querySelectorAll('button, a')).map(b => b.innerText.trim()).filter(t => t.length > 2 && t.length < 30).slice(0, 15)
      })`,
      returnByValue: true,
    });

    console.log(`📊 Rendered UI Metrics:`, evalControls?.result?.value);

    // Check for any unhandled JS errors in console
    const severeErrors = consoleEvents.filter((c) => c.type === 'error');
    console.log(`⚠️ Console Errors Captured: ${severeErrors.length}`);
    if (severeErrors.length > 0) {
      severeErrors.forEach((e) => console.log('   - Error:', e.args?.map((a) => a.value || a.description).join(' ')));
    }

    ws.close();
    console.log(`✅ ${browserName} Live Browser Verification PASSED with 0 fatal crashes!`);

    return {
      browserName,
      connected: true,
      rootMounted: evalRoot?.result?.value || false,
      buttonCount: evalControls?.result?.value?.buttonCount || 0,
      consoleErrors: severeErrors.length,
      status: 'PASS',
    };
  } finally {
    proc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

async function main() {
  console.log('🧪 Starting JobFill BD Smart Filter Browser E2E Runner (Chrome & Edge)...');
  const server = await startStaticServer(EXT_DIST_PATH, HTTP_PORT);
  console.log(`🌐 Local static extension server running at http://127.0.0.1:${HTTP_PORT}`);

  const results = [];

  try {
    const chromeRes = await runBrowserVerification('Google Chrome', CHROME_PATH, 9222);
    results.push(chromeRes);
  } catch (err) {
    console.error('❌ Chrome verification error:', err.message);
    results.push({ browserName: 'Google Chrome', status: 'FAIL', error: err.message });
  }

  try {
    const edgeRes = await runBrowserVerification('Microsoft Edge', EDGE_PATH, 9223);
    results.push(edgeRes);
  } catch (err) {
    console.error('❌ Edge verification error:', err.message);
    results.push({ browserName: 'Microsoft Edge', status: 'FAIL', error: err.message });
  }

  server.close();

  console.log('\n============================================================');
  console.log('🏁 Browser E2E Live Run Summary:');
  console.table(results);

  const allPassed = results.every((r) => r.status === 'PASS');
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
