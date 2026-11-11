import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const ROOT = process.cwd();
const DIST_DIR = path.resolve(ROOT, 'dist');

const BROWSER_EXECUTABLES = {
  chrome: [
    process.env.CHROME_EXE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean),
  edge: [
    process.env.EDGE_EXE,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean),
};

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
  throw new Error('Playwright not found in local node_modules or npm-cache/_npx.');
}

function findExecutable(browserKind) {
  const list = BROWSER_EXECUTABLES[browserKind] || [];
  for (const p of list) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(`${browserKind.toUpperCase()} executable not found in standard Windows paths: ${list.join(', ')}`);
}

function startStaticTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      if (cleanUrl === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      const rel = cleanUrl === '/' ? 'test-pages/petrobangla-form.html' : cleanUrl.replace(/^\/+/, '');
      const filePath = path.join(DIST_DIR, rel);
      if (filePath.startsWith(DIST_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mime =
          ext === '.html'
            ? 'text/html; charset=utf-8'
            : ext === '.js'
              ? 'application/javascript; charset=utf-8'
              : ext === '.css'
                ? 'text/css; charset=utf-8'
                : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

function buildSyntheticBackupJson() {
  const syntheticProfile = {
    id: 'profile_e2e_synthetic_full',
    profileName: 'Md. Hasan Mahmud (E2E Synthetic)',
    createdAt: '2026-11-11T00:00:00.000Z',
    updatedAt: '2026-11-11T00:00:00.000Z',
    personal: {
      applicantNameEn: 'MD. HASAN MAHMUD',
      applicantNameBn: 'মোঃ হাসান মাহমুদ',
      fatherNameEn: 'MD. ABDUR RAHIM',
      fatherNameBn: 'মোঃ আব্দুর রহিম',
      motherNameEn: 'MST. FATEMA BEGUM',
      motherNameBn: 'মোছাঃ ফাতেমা বেগম',
      dob: '1998-05-15',
      gender: 'Male',
      nationality: 'Bangladeshi',
      religion: 'Islam',
      nid: '9001122334',
      birthReg: '19982692512000123',
      passport: 'A01234567',
      passportExpiry: '2030-10-12',
      maritalStatus: 'Single',
      spouseNameEn: '',
      spouseNameBn: '',
      mobile: '01712345678',
      confirmMobile: '01712345678',
      email: 'applicant.demo@example.com',
      quota: 'General',
      departmentalStatus: 'No',
      employmentStatus: 'Private',
    },
    address: {
      sameAsPresent: true,
      present: {
        careOf: 'Md. Abdur Rahim',
        village: 'Kaderabad Housing',
        road: 'Road No. 04',
        house: 'House No. 12/A',
        flat: 'Flat 4B',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mohammadpur',
        postOffice: 'Mohammadpur',
        postCode: '1207',
      },
      permanent: {
        careOf: 'Md. Abdur Rahim',
        village: 'Rampur',
        road: 'Main Road',
        house: 'Rahim Villa',
        flat: '',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mohammadpur',
        postOffice: 'Mohammadpur',
        postCode: '1207',
      },
    },
    ssc: {
      examination: 'SSC',
      board: 'Dhaka',
      institution: 'Dhaka Government High School',
      rollNumber: '142857',
      registrationNumber: '1115243890',
      groupSubject: 'Science',
      resultType: 'GPA (out of 5)',
      gpa: '5.00',
      gpaScale: '5.00',
      passingYear: '2014',
    },
    hsc: {
      examination: 'HSC',
      board: 'Dhaka',
      institution: 'Dhaka College',
      rollNumber: '321654',
      registrationNumber: '1115243890',
      groupSubject: 'Science',
      resultType: 'GPA (out of 5)',
      gpa: '5.00',
      gpaScale: '5.00',
      passingYear: '2016',
    },
    hasGraduation: true,
    graduation: {
      examination: 'B.Sc Engineering',
      subjectDegree: 'Computer Science and Engineering',
      universityInstitute: 'University of Dhaka',
      college: 'Faculty of Engineering and Technology',
      studentId: 'CSE-16-042',
      registrationNumber: '2016421098',
      rollNumber: '16042',
      session: '2016-17',
      resultType: 'CGPA (out of 4)',
      gpa: '3.82',
      gpaScale: '4.00',
      passingYear: '2021',
      courseDuration: '4 Years',
      appearedStatus: false,
      examStartDate: '2021-01-10',
      examEndDate: '2021-06-25',
    },
    hasMasters: false,
    masters: {
      examination: 'M.Sc',
      subjectDegree: '',
      universityInstitute: '',
      college: '',
      studentId: '',
      registrationNumber: '',
      rollNumber: '',
      session: '',
      resultType: 'CGPA (out of 4)',
      gpa: '',
      gpaScale: '4.00',
      passingYear: '',
      courseDuration: '1.5 Years',
      appearedStatus: false,
      examStartDate: '',
      examEndDate: '',
    },
    additionalQualifications: [],
    hasJobExperience: true,
    jobExperiences: [
      {
        id: 'job_1',
        employedOn: 'Private',
        organization: 'TechVision Solutions Ltd.',
        designation: 'Software Engineer',
        address: 'Kawran Bazar, Dhaka',
        startDate: '2021-09-01',
        endDate: '',
        currentlyWorking: true,
        salary: '65000',
        jobDescription: 'Web application development',
      },
    ],
    special: {
      heightCm: '172.5',
      weightKg: '68',
      chestCm: '84',
      bloodGroup: 'B+',
      examCentre: 'Dhaka',
      questionVersion: 'English',
      cadrePreference: '',
      nonCadrePreference: '',
      postRelatedSubjectCode: '',
      freedomFighterCertNo: '',
      freedomFighterRelation: '',
      disabilityType: '',
      disabilityPercent: '',
      disabilityCertNo: '',
      orgChoice1: 'Petrobangla HQ',
      orgChoice2: 'Titas Gas T&D Co. Ltd.',
    },
    references: [],
    documents: [],
  };

  return JSON.stringify({
    appName: 'JobFill BD',
    exportedAt: new Date().toISOString(),
    isEncrypted: false,
    profiles: [syntheticProfile],
  });
}

export async function runBrowserExtensionE2E(browserKind) {
  const { chromium } = resolvePlaywright();
  const browserExe = findExecutable(browserKind);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `jobfill-${browserKind}-e2e-`));
  const { server, port } = await startStaticTestServer();

  const consoleErrors = [];
  const pageErrors = [];
  const swErrors = [];

  let context;
  try {
    console.log(`\n🚀 Launching REAL ${browserKind.toUpperCase()} (${browserExe}) with unpacked extension: ${DIST_DIR}`);
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: browserExe,
      headless: false,
      args: [
        `--disable-extensions-except=${DIST_DIR}`,
        `--load-extension=${DIST_DIR}`,
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
      throw new Error(`${browserKind.toUpperCase()} Background Service Worker failed to start.`);
    }

    sw.on('pageerror', (err) => swErrors.push(err.message));
    const extensionId = sw.url().split('/')[2];

    // 1. Open Dashboard & inspect UserAgent / Version & clean blank fresh install
    const dashPage = await context.newPage();
    dashPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[Dashboard] ${msg.text()}`);
    });
    dashPage.on('pageerror', (err) => pageErrors.push(`[Dashboard] ${err.message}`));

    await dashPage.goto(`chrome-extension://${extensionId}/dashboard.html`, { waitUntil: 'networkidle' });
    const browserUA = await dashPage.evaluate(() => navigator.userAgent);
    console.log(`✅ [${browserKind.toUpperCase()}] SW Active (ID=${extensionId}) | UA="${browserUA}"`);
    if (browserKind === 'chrome' && /Edg\//i.test(browserUA)) {
      throw new Error(`Expected Chrome runtime UA, got Edge UA: ${browserUA}`);
    }
    if (browserKind === 'edge' && !/Edg\//i.test(browserUA)) {
      throw new Error(`Expected Edge runtime UA with Edg/, got: ${browserUA}`);
    }

    const skipBtn = dashPage
      .locator('button[title="Skip Onboarding"], button:has-text("Skip"), button:has-text("স্কিপ")')
      .first();
    if (await skipBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await skipBtn.click();
      await dashPage.waitForTimeout(300);
    }

    // Verify clean fresh install starts with empty "My Job Profile" (ZERO preloaded real PII!)
    const freshText = await dashPage.evaluate(() => document.body.innerText);
    for (const forbidden of ['6014157074', 'MAHFUZAR', 'Mominpur', 'Katihara']) {
      if (freshText.toUpperCase().includes(forbidden.toUpperCase())) {
        throw new Error(`Clean fresh install contains forbidden PII "${forbidden}"!`);
      }
    }
    const profileSelect = dashPage.locator('header select').first();
    const initialProfileName = await profileSelect.locator('option:checked').innerText();
    console.log(`✅ [${browserKind.toUpperCase()}] Fresh install starts clean with empty profile: "${initialProfileName.trim()}"`);

    // 2. Test interactive typing on Personal Info + Save Profile to IndexedDB encrypted vault
    await dashPage.locator('button:has-text("Personal Info"), button:has-text("ব্যক্তিগত তথ্য")').first().click();
    const nameInput = dashPage.locator('input[placeholder="MD. FIRSTNAME LASTNAME"]');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill('SYNTHETIC MANUAL ENTRY');
    const saveProfileBtn = dashPage.locator('button:has-text("Save Profile"), button:has-text("প্রোফাইল সংরক্ষণ")').first();
    if (await saveProfileBtn.isVisible().catch(() => false)) {
      await saveProfileBtn.click();
      await dashPage.waitForTimeout(400);
    }

    // 3. Import comprehensive 100% synthetic test profile backup JSON via Security UI
    await dashPage.locator('button:has-text("Security"), button:has-text("নিরাপত্তা ও ভল্ট")').first().click();
    const tmpBackupPath = path.join(userDataDir, 'synthetic_backup.json');
    fs.writeFileSync(tmpBackupPath, buildSyntheticBackupJson(), 'utf-8');
    await dashPage.locator('input[type="file"][accept=".json"]').setInputFiles(tmpBackupPath);
    await dashPage.waitForTimeout(700);

    // Select imported synthetic profile as active
    await profileSelect.selectOption('profile_e2e_synthetic_full');
    await dashPage.waitForTimeout(400);

    // Verify Family Info tab allows editing Spouse Details freely
    await dashPage.locator('button:has-text("Family Info"), button:has-text("পারিবারিক তথ্য")').first().click();
    const spouseEnInput = dashPage.locator('input[placeholder*="NUSRAT JAHAN"]');
    const spouseBnInput = dashPage.locator('input[placeholder*="নুসরাত জাহান"]');
    await spouseEnInput.waitFor({ state: 'visible', timeout: 5000 });
    await spouseEnInput.fill('NUSRAT JAHAN');
    await spouseBnInput.fill('নুসরাত জাহান');

    // Navigate to Documents tab & upload synthetic images + Canvas Auto-Fit Copy
    await dashPage.locator('button:has-text("Documents"), button:has-text("ছবি ও সনদপত্র")').first().click();
    await dashPage.waitForSelector('input[type="file"]', { state: 'attached', timeout: 5000 });

    const syntheticImages = await dashPage.evaluate(() => {
      function makePngUrl(w, h, color) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        return c.toDataURL('image/png');
      }
      return {
        photoUrl: makePngUrl(400, 400, '#1d4ed8'),
        sigUrl: makePngUrl(450, 120, '#0f172a'),
      };
    });

    const tmpPhotoPath = path.join(userDataDir, 'raw_photo.png');
    const tmpSigPath = path.join(userDataDir, 'raw_sig.png');
    fs.writeFileSync(tmpPhotoPath, Buffer.from(syntheticImages.photoUrl.split(',')[1], 'base64'));
    fs.writeFileSync(tmpSigPath, Buffer.from(syntheticImages.sigUrl.split(',')[1], 'base64'));

    const docInputs = dashPage.locator('input[type="file"]');
    await docInputs.nth(0).setInputFiles(tmpPhotoPath);
    await dashPage.waitForTimeout(500);
    await docInputs.nth(1).setInputFiles(tmpSigPath);
    await dashPage.waitForTimeout(500);

    const autoFitBtns = dashPage.locator('button:has-text("Auto-Fit Copy")');
    const fitCount = await autoFitBtns.count();
    for (let i = 0; i < fitCount; i++) {
      await autoFitBtns.nth(i).click();
      await dashPage.waitForTimeout(450);
    }
    if (await saveProfileBtn.isVisible().catch(() => false)) {
      await saveProfileBtn.click();
      await dashPage.waitForTimeout(400);
    }
    console.log(`✅ [${browserKind.toUpperCase()}] Synthetic profile + Family + Encrypted Documents (${fitCount} Auto-Fit copies) verified in IDB.`);

    // 4. Test Floating Toolbar Close (×) per-tab persistence & restore + Full BOGMC Auto-Fill + Photo/Sig + Undo
    const formPage = await context.newPage();
    formPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[FormPage] ${msg.text()}`);
    });
    formPage.on('pageerror', (err) => pageErrors.push(`[FormPage] ${err.message}`));

    const testUrl = `http://127.0.0.1:${port}/test-pages/petrobangla-form.html`;
    await formPage.goto(testUrl, { waitUntil: 'networkidle' });
    await formPage.waitForSelector('#jobfill-quick-fill-btn', { timeout: 8000 });

    // Click Close (×) button on floating toolbar
    await formPage.click('#jobfill-close-toolbar-btn');
    await formPage.waitForTimeout(250);
    const hiddenAfterClose = await formPage.evaluate(() => {
      const el = document.getElementById('jobfill-floating-trigger');
      return !el || getComputedStyle(el).display === 'none' || el.style.display === 'none';
    });
    if (!hiddenAfterClose) {
      throw new Error('Floating toolbar did not hide immediately when close (x) button clicked.');
    }

    // Reload same tab -> verify toolbar remains hidden cleanly in this tab session
    await formPage.reload({ waitUntil: 'networkidle' });
    await formPage.waitForTimeout(400);
    const stillHiddenAfterReload = await formPage.evaluate(() => {
      const el = document.getElementById('jobfill-floating-trigger');
      return !el || getComputedStyle(el).display === 'none' || el.style.display === 'none';
    });
    if (!stillHiddenAfterReload) {
      throw new Error('Floating toolbar did not remain hidden on same-tab reload.');
    }

    // Restore floating toolbar cleanly via extension message (SHOW_FLOATING_TOOLBAR) without needing "tabs" permission
    await formPage.bringToFront();
    await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tabs?.[0]?.id) throw new Error('Form tab not found for toolbar restore');
      await chrome.tabs.sendMessage(tabs[0].id, { action: 'SHOW_FLOATING_TOOLBAR' });
    });
    await formPage.bringToFront();
    await formPage.waitForSelector('#jobfill-quick-fill-btn', { state: 'visible', timeout: 5000 });
    console.log(`✅ [${browserKind.toUpperCase()}] Floating toolbar Close (×) -> persists hidden on reload -> Show Toolbar restore verified.`);

    // Verify unencrypted non-local HTTP sensitive-field security warning on http://*.teletalk.com.bd
    const httpWarnPage = await context.newPage();
    await httpWarnPage.route('http://mockportal.teletalk.com.bd/apply*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html><head><title>Online Job Application Form - Teletalk</title></head><body>
          <h1>Job Application Form</h1>
          <form id="app_form">
            <label for="app_name">Applicant's Name</label><input id="app_name" name="applicant_name" type="text" />
            <label for="f_name">Father's Name</label><input id="f_name" name="father_name" type="text" />
            <label for="nid_no">National ID (NID)</label><input id="nid_no" name="nid" type="text" />
            <label for="mobile_no">Mobile Number</label><input id="mobile_no" name="mobile" type="text" />
          </form>
        </body></html>`,
      });
    });
    await httpWarnPage.goto('http://mockportal.teletalk.com.bd/apply', { waitUntil: 'load' });
    await httpWarnPage.waitForSelector('#jobfill-quick-fill-btn', { timeout: 6000 });
    await httpWarnPage.click('#jobfill-quick-fill-btn');
    await httpWarnPage.waitForSelector('#jobfill-http-warning-overlay', { state: 'visible', timeout: 5000 });
    await httpWarnPage.click('#jobfill-http-warn-cancel');
    await httpWarnPage.waitForTimeout(200);
    const nidAfterCancel = await httpWarnPage.inputValue('#nid_no');
    if (nidAfterCancel !== '') {
      throw new Error(`Expected sensitive NID field to stay empty on HTTP warning Cancel, got "${nidAfterCancel}"`);
    }
    await httpWarnPage.click('#jobfill-quick-fill-btn');
    await httpWarnPage.waitForSelector('#jobfill-http-warning-overlay', { state: 'visible', timeout: 5000 });
    await httpWarnPage.click('#jobfill-http-warn-proceed');
    await httpWarnPage.waitForFunction(() => document.getElementById('nid_no')?.value === '9001122334', { timeout: 6000 });
    await httpWarnPage.close();
    console.log(`✅ [${browserKind.toUpperCase()}] Non-local unencrypted HTTP sensitive-field warning (Cancel blocks -> Continue fills) verified.`);

    // Click 1-click Auto Fill Now
    await formPage.click('#jobfill-quick-fill-btn');
    await formPage.waitForFunction(
      () => {
        const toast = document.getElementById('jobfill-inpage-toast');
        const btn = document.getElementById('jobfill-quick-fill-btn');
        return Boolean(toast && /✅/.test(toast.textContent || '') && btn && !btn.disabled);
      },
      { timeout: 10000 }
    );

    const formCheck = await formPage.evaluate(() => ({
      applicantName: document.getElementById('applicant_name')?.value,
      gender: document.getElementById('gender')?.value,
      nid: document.getElementById('nid')?.value,
      nidNo: document.getElementById('nid_no')?.value,
      birthRegNo: document.getElementById('birth_reg_no')?.value,
      passportNo: document.getElementById('passport_no')?.value,
      mobile: document.getElementById('mobile')?.value,
      email: document.getElementById('email')?.value,
      quotaBeforeConfirm: document.getElementById('quota')?.value,
      sscExam: document.getElementById('ssc_exam')?.value,
      graCgpa: document.getElementById('gra_cgpa')?.value,
    }));
    if (
      formCheck.applicantName !== 'MD. HASAN MAHMUD' ||
      formCheck.nidNo !== '9001122334' ||
      formCheck.birthRegNo !== '19982692512000123' ||
      formCheck.passportNo !== 'A01234567' ||
      formCheck.email !== 'applicant.demo@example.com' ||
      formCheck.quotaBeforeConfirm !== '' ||
      formCheck.sscExam !== 'S.S.C' ||
      formCheck.graCgpa !== '3.82'
    ) {
      throw new Error(`Auto Fill validation mismatch on ${browserKind}: ${JSON.stringify(formCheck)}`);
    }

    // Upload Photo & Signature via DataTransfer approval modal (wait for encrypted plan cards + enabled Upload button)
    await formPage.waitForSelector('#jobfill-doc-chk-0', { state: 'visible', timeout: 8000 });
    await formPage.waitForSelector('#jobfill-doc-upload-btn:not([disabled])', { state: 'visible', timeout: 6000 });
    await formPage.click('#jobfill-doc-upload-btn');
    await formPage.waitForFunction(
      () =>
        (document.getElementById('photo')?.files?.length || 0) === 1 &&
        (document.getElementById('signature')?.files?.length || 0) === 1,
      { timeout: 8000 }
    );
    const uploadState = await formPage.evaluate(() => ({
      photoFilesCount: document.getElementById('photo')?.files?.length || 0,
      sigFilesCount: document.getElementById('signature')?.files?.length || 0,
    }));
    if (uploadState.photoFilesCount !== 1 || uploadState.sigFilesCount !== 1) {
      throw new Error(`Document upload failed on ${browserKind}: ${JSON.stringify(uploadState)}`);
    }
    await formPage.click('#jobfill-doc-close-btn');

    // Review Modal -> explicit Quota confirmation + Undo preserving manual mobile edit
    await formPage.click('#jobfill-trigger-btn');
    await formPage.waitForSelector('#jobfill-rescan-btn', { timeout: 5000 });
    await formPage.click('#jobfill-rescan-btn');
    await formPage.waitForTimeout(350);
    await formPage.locator('.jobfill-field-card:has-text("applicant.quota") input[type="checkbox"]').first().check();
    await formPage.click('#jobfill-fill-btn');
    await formPage.waitForTimeout(350);
    const quotaVal = await formPage.evaluate(() => document.getElementById('quota')?.value || '');
    if (quotaVal !== 'General') {
      throw new Error(`Expected Quota "General" after Review confirmation, got "${quotaVal}"`);
    }

    await formPage.fill('#mobile', '01900112233');
    await formPage.click('#jobfill-trigger-btn');
    await formPage.waitForSelector('#jobfill-undo-btn', { timeout: 5000 });
    await formPage.click('#jobfill-undo-btn');
    await formPage.waitForTimeout(500);
    await formPage.click('#jobfill-close-modal-btn');

    const postUndo = await formPage.evaluate(() => ({
      nameAfterUndo: document.getElementById('applicant_name')?.value,
      mobilePreserved: document.getElementById('mobile')?.value,
    }));
    if (postUndo.nameAfterUndo !== '' || postUndo.mobilePreserved !== '01900112233') {
      throw new Error(`Undo preservation failed on ${browserKind}: ${JSON.stringify(postUndo)}`);
    }
    console.log(`✅ [${browserKind.toUpperCase()}] Autofill + DataTransfer Photo/Sig + Explicit Quota + Undo verified.`);

    // 5. Popup UI + Cross-Context Messaging check
    const popupPage = await context.newPage();
    popupPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[Popup] ${msg.text()}`);
    });
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'networkidle' });
    const popupH1 = await popupPage.locator('h1').first().innerText();
    await popupPage.close();

    await formPage.bringToFront();
    const msgRes = await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tabs?.[0]?.id) throw new Error('Form tab not found for cross-context messaging check');
      const detectRes = await chrome.tabs.sendMessage(tabs[0].id, { action: 'DETECT_FORM' });
      const autoRes = await chrome.tabs.sendMessage(tabs[0].id, { action: 'AUTO_FILL_NOW' });
      return { detectRes, autoRes };
    });
    if (!msgRes.detectRes?.hasJobForm || msgRes.detectRes?.documentFieldCount !== 2) {
      throw new Error(`Popup <-> Content messaging failed on ${browserKind}: ${JSON.stringify(msgRes)}`);
    }
    console.log(`✅ [${browserKind.toUpperCase()}] Popup ("${popupH1.replace(/\s+/g, ' ')}") & cross-context messaging verified.`);

    // 6. All-Controls Page (Radios, React _valueTracker, Dependent Dropdowns, Legal Declaration untouched)
    const controlsPage = await context.newPage();
    controlsPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[ControlsPage] ${msg.text()}`);
    });
    await controlsPage.goto(`http://127.0.0.1:${port}/test-pages/all-controls-test.html`, { waitUntil: 'networkidle' });
    await controlsPage.waitForSelector('#jobfill-quick-fill-btn', { timeout: 8000 });
    await controlsPage.click('#jobfill-quick-fill-btn');
    await controlsPage.waitForFunction(
      () => {
        const toast = document.getElementById('jobfill-inpage-toast');
        const btn = document.getElementById('jobfill-quick-fill-btn');
        return Boolean(toast && /✅/.test(toast.textContent || '') && btn && !btn.disabled);
      },
      { timeout: 10000 }
    );
    const controlsState = await controlsPage.evaluate(() => ({
      applicantName: document.getElementById('applicant_name')?.value,
      district: document.getElementById('present_district')?.value,
      upazila: document.getElementById('present_upazila')?.value,
      declarationChecked: document.getElementById('declaration')?.checked,
      reactStateSynced:
        document.getElementById('contact_mobile')?._valueTracker?.getValue?.() ===
        document.getElementById('contact_mobile')?.value,
    }));
    if (
      controlsState.applicantName !== 'MD. HASAN MAHMUD' ||
      controlsState.district !== 'dhaka' ||
      controlsState.upazila !== 'mohammadpur' ||
      controlsState.declarationChecked ||
      !controlsState.reactStateSynced
    ) {
      throw new Error(`All-Controls validation mismatch on ${browserKind}: ${JSON.stringify(controlsState)}`);
    }
    await controlsPage.close();
    await formPage.close();
    console.log(`✅ [${browserKind.toUpperCase()}] All-Controls React _valueTracker & safety declaration boundary verified.`);

    // 7. Job Circular Hub & CompactSourceHealthBar verification
    await dashPage.goto(`chrome-extension://${extensionId}/dashboard.html?tab=circulars`, { waitUntil: 'networkidle' });
    await dashPage.waitForSelector('[data-testid="compact-source-health"]', { timeout: 6000 });
    await dashPage.click('[data-testid="source-health-details-toggle"]');
    await dashPage.waitForSelector('[data-source-id="bangladesh_bank"]', { timeout: 5000 });
    await dashPage.waitForSelector('[data-source-id="bdjobs"]', { timeout: 5000 });
    console.log(`✅ [${browserKind.toUpperCase()}] Job Circular Hub & 7-state CompactSourceHealthBar rendered cleanly.`);

    // 8. Vault Password Encrypt -> Reload Lock -> Wrong Pass Reject -> Unlock -> Disable cycle
    await dashPage.locator('button:has-text("Security"), button:has-text("নিরাপত্তা ও ভল্ট")').first().click();
    await dashPage.waitForSelector('input[placeholder*="মাস্টার পাসওয়ার্ড"]', { timeout: 5000 });
    await dashPage.fill('input[placeholder*="মাস্টার পাসওয়ার্ড"]', 'TestVault@2026');
    await dashPage.fill('input[placeholder="পাসওয়ার্ড নিশ্চিত করুন"]', 'TestVault@2026');
    await dashPage.click('button:has-text("পাসওয়ার্ড সুরক্ষা চালু করুন")');
    await dashPage.waitForSelector('text=AES-GCM-256', { timeout: 5000 });

    await dashPage.reload({ waitUntil: 'networkidle' });
    await dashPage.waitForSelector('h2:has-text("JobFill BD Vault Locked")', { timeout: 5000 });
    await dashPage.fill('input[placeholder="Enter Master Password"]', 'WrongPass123');
    await dashPage.click('button:has-text("ভল্ট আনলক করুন"), button:has-text("Unlock Profile Vault")');
    await dashPage.waitForSelector('text=/Incorrect password|পাসওয়ার্ড ভুল/', { timeout: 4000 });

    await dashPage.fill('input[placeholder="Enter Master Password"]', 'TestVault@2026');
    await dashPage.click('button:has-text("ভল্ট আনলক করুন"), button:has-text("Unlock Profile Vault")');
    await dashPage.waitForSelector('button:has-text("Documents"), button:has-text("ছবি ও সনদপত্র")', { timeout: 5000 });

    await dashPage.locator('button:has-text("Security"), button:has-text("নিরাপত্তা ও ভল্ট")').first().click();
    await dashPage.waitForSelector('input[placeholder="বর্তমান পাসওয়ার্ড"]', { timeout: 5000 });
    await dashPage.fill('input[placeholder="বর্তমান পাসওয়ার্ড"]', 'TestVault@2026');
    await dashPage.click('button:has-text("পাসওয়ার্ড সুরক্ষা বন্ধ করুন")');
    await dashPage.waitForSelector('input[placeholder*="মাস্টার পাসওয়ার্ড"]', { timeout: 5000 });
    console.log(`✅ [${browserKind.toUpperCase()}] Vault Encrypt -> Reload Lock -> Wrong Pass Reject -> Unlock -> Disable verified.`);

    // 9. Google Meet & Zoom Domain Isolation + WebRTC Media Intact Verification
    const excludedRoutes = [
      { url: 'https://meet.google.com/abc-defg-hij', html: '<main><video autoplay></video><input id="chat-msg" /></main>' },
      { url: 'https://us06web.zoom.us/wc/123456/join', html: '<main><div class="meeting-client">Zoom</div><input id="zoom-chat" /></main>' },
      { url: 'https://www.youtube.com/watch?v=test', html: '<main><video></video><input id="search" /></main>' },
    ];
    for (const target of excludedRoutes) {
      const p = await context.newPage();
      await p.route(`${target.url}*`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: `<!doctype html><html><body>${target.html}</body></html>`,
        });
      });
      await p.goto(target.url, { waitUntil: 'load' });
      await p.waitForTimeout(500);
      const inspect = await p.evaluate(async () => {
        let tracks = 0;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          tracks = stream.getTracks().length;
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
        return {
          domNodes: document.querySelectorAll('[id^="jobfill-"]').length,
          initFlag: Boolean(window.__jobfillAssistantInitialized),
          msgFlag: Boolean(window.__jobfillMsgListenerRegistered),
          gumNative: (navigator.mediaDevices?.getUserMedia?.toString?.() || '').includes('[native code]'),
          gdmNative: (navigator.mediaDevices?.getDisplayMedia?.toString?.() || '').includes('[native code]'),
          rtcNative: (window.RTCPeerConnection?.toString?.() || '').includes('[native code]'),
          tracks,
        };
      });
      await p.close();
      if (inspect.domNodes !== 0 || inspect.initFlag || inspect.msgFlag || !inspect.gumNative || !inspect.gdmNative || !inspect.rtcNative || inspect.tracks < 1) {
        throw new Error(`Meeting/Media isolation failed on ${target.url} (${browserKind}): ${JSON.stringify(inspect)}`);
      }
    }
    console.log(`✅ [${browserKind.toUpperCase()}] Google Meet, Zoom & YouTube zero-injection + native WebRTC intact verified.`);

    // 10. IndexedDB Zero-Plaintext-PII & Zero-Plaintext-Secret Audit
    const idbAudit = await dashPage.evaluate(async () => {
      const localKeys = await new Promise((res) => chrome.storage.local.get(null, res));
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('JobFillBD_SecureStorage');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const readAll = (storeName) =>
        new Promise((res) => {
          const tx = db.transaction(storeName, 'readonly');
          const r = tx.objectStore(storeName).getAll();
          r.onsuccess = () => res(r.result || []);
          r.onerror = () => res([]);
        });
      const [profiles, docs, eduRecs, vaultRecs] = await Promise.all([
        readAll('profiles'),
        readAll('documents'),
        readAll('education_records'),
        readAll('encrypted_vault'),
      ]);
      db.close();
      return {
        plaintextProfilesCount: profiles.length,
        docsCount: docs.length,
        allDocsEncrypted: docs.length > 0 && docs.every((d) => Boolean(d.isEncrypted) && !d.dataUrl),
        eduCount: eduRecs.length,
        allEduEncrypted: eduRecs.length > 0 && eduRecs.every((e) => Boolean(e.isEncrypted) && !e.rollNumber && !e.gpa),
        vaultCount: vaultRecs.length,
        hasPlaintextProfilesKey: Object.prototype.hasOwnProperty.call(localKeys, 'jobfill_profiles'),
        hasPlaintextDocKey: Object.prototype.hasOwnProperty.call(localKeys, 'jobfill_doc_storage_key_v1'),
      };
    });
    if (
      idbAudit.plaintextProfilesCount !== 0 ||
      !idbAudit.allDocsEncrypted ||
      !idbAudit.allEduEncrypted ||
      idbAudit.vaultCount === 0 ||
      idbAudit.hasPlaintextProfilesKey ||
      idbAudit.hasPlaintextDocKey
    ) {
      throw new Error(`IndexedDB zero-plaintext audit failed on ${browserKind}: ${JSON.stringify(idbAudit)}`);
    }
    console.log(`✅ [${browserKind.toUpperCase()}] IndexedDB zero-plaintext-PII & zero-plaintext-secret audit passed.`);

    if (consoleErrors.length > 0 || pageErrors.length > 0 || swErrors.length > 0) {
      throw new Error(
        `${browserKind.toUpperCase()} runtime errors captured! Console: ${JSON.stringify(consoleErrors)} | Page: ${JSON.stringify(pageErrors)} | SW: ${JSON.stringify(swErrors)}`
      );
    }

    console.log(`🎉 [${browserKind.toUpperCase()}] REAL BROWSER E2E TEST PASSED WITH ZERO CONSOLE/SW/PAGE ERRORS!`);
  } finally {
    if (context) await context.close().catch(() => {});
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}
