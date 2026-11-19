// Test headless Chrome navigation to real BPSC live portal
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9255;

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
  const tmpDir = path.resolve('.tmp_chrome_bpsc_test');
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

    const title = await cdp.evaluate('document.title');
    console.log('Live BPSC Apply Page Title:', title);

    const radios = await cdp.evaluate(`
      Array.from(document.querySelectorAll('input[type="radio"]')).map(r => ({ id: r.id, name: r.name, value: r.value }))
    `);
    console.log('Radios found:', radios);

    // Select circular and submit applynow.php
    console.log('Selecting circular radio...');
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

    const title2 = await cdp.evaluate('document.title');
    const url2 = await cdp.evaluate('window.location.href');
    console.log('Step 2 URL:', url2, 'Title:', title2);

    // Check posts on applynow.php
    const postRadios = await cdp.evaluate(`
      Array.from(document.querySelectorAll('input[name="postid"]')).map(r => ({ id: r.id, value: r.value, label: r.parentElement.innerText.trim() }))
    `);
    console.log('Post radios count:', postRadios.length, 'Sample:', postRadios.slice(0, 3));

    // Select first post and submit application.php
    console.log('Selecting post radio and submitting application.php...');
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

    const appUrl = await cdp.evaluate('window.location.href');
    const appTitle = await cdp.evaluate('document.title');
    const inputCount = await cdp.evaluate('document.querySelectorAll("input").length');
    const selectCount = await cdp.evaluate('document.querySelectorAll("select").length');
    console.log('Step 3 Application Form URL:', appUrl);
    console.log('Step 3 Title:', appTitle);
    console.log('Inputs found on live official BPSC form:', inputCount);
    console.log('Selects found on live official BPSC form:', selectCount);

    cdp.close();
  } finally {
    proc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

run().catch(console.error);
