// Inspect live official BPSC application form fields
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9256;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
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
    return res?.result?.value;
  }
  close() {
    if (this.ws) try { this.ws.close(); } catch {}
  }
}

async function run() {
  const tmpDir = path.resolve('.tmp_inspect_bpsc');
  fs.mkdirSync(tmpDir, { recursive: true });

  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--ignore-certificate-errors',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await sleep(2000);
    const target = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/new?https://bpsc.teletalk.com.bd/ncad/apply.php`, { method: 'PUT' });
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await sleep(3500);

    // Select circular
    await cdp.evaluate(`
      const r = document.querySelector('input[type="radio"]');
      if (r) {
        r.checked = true;
        const btn = document.getElementById('button02');
        if (btn) btn.disabled = false;
        document.getElementById('applyform').submit();
      }
    `);
    await sleep(3000);

    // Select post
    await cdp.evaluate(`
      const p = document.querySelector('input[name="postid"]');
      if (p) {
        p.checked = true;
        const btn = document.getElementById('button02');
        if (btn) btn.disabled = false;
        document.getElementById('applyform').submit();
      }
    `);
    await sleep(4000);

    // Now on application form! Extract all inputs and selects with their labels and parent row text
    const fieldDetails = await cdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const extracted = [];
        
        rows.forEach(tr => {
          const text = tr.innerText.trim();
          const inputs = Array.from(tr.querySelectorAll('input, select, textarea'));
          if (inputs.length > 0) {
            extracted.push({
              rowLabel: tr.cells[0] ? tr.cells[0].innerText.trim() : '',
              fullRowText: text.slice(0, 100),
              controls: inputs.map(el => ({
                tag: el.tagName.toLowerCase(),
                type: el.getAttribute('type') || el.tagName.toLowerCase(),
                name: el.getAttribute('name') || '',
                id: el.id || '',
                options: el.tagName.toLowerCase() === 'select' ? Array.from(el.options).map(o => ({ value: o.value, text: o.text })).slice(0, 6) : []
              }))
            });
          }
        });
        return extracted;
      })()
    `);

    console.log('Extracted Rows with Form Controls:', fieldDetails.length);
    fs.writeFileSync('bpsc_live_form_fields.json', JSON.stringify(fieldDetails, null, 2));
    console.log('Saved to bpsc_live_form_fields.json');

    cdp.close();
  } finally {
    proc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

run().catch(console.error);
