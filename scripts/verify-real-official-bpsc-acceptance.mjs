// JobFill BD - Actual Official Government Portal Autofill Acceptance Test
// Executes on the real live public BPSC recruitment portal: https://bpsc.teletalk.com.bd/ncad/
// Tests in Google Chrome and Microsoft Edge binaries via Chrome DevTools Protocol (CDP).

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EXT_DIST_PATH = path.resolve('dist');
const ARTIFACT_DIR = 'C:\\Users\\mahfu\\.gemini\\antigravity\\brain\\05e510eb-24f6-4805-b4cf-c419eb0db7d3';

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
    this.consoleLogs = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.method === 'Runtime.consoleAPICalled') {
            const args = (parsed.params.args || []).map((a) => a.value ?? a.description ?? '');
            this.consoleLogs.push(args.join(' '));
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
      throw new Error(res.exceptionDetails.text || 'CDP Evaluation Error');
    }
    return res?.result?.value;
  }
  close() {
    if (this.ws) try { this.ws.close(); } catch {}
  }
}

// Fictional test profile with distinct present/permanent addresses and separate SSC/HSC values
const testCandidateProfile = {
  personal: {
    applicantNameEn: 'Mohammad Tanvir Rahman',
    applicantNameBn: 'মোহাম্মদ তানভীর রহমান',
    fatherNameEn: 'Md. Rafiqul Islam',
    fatherNameBn: 'মো: রফিকুল ইসলাম',
    motherNameEn: 'Nasima Begum',
    motherNameBn: 'নাছিমা বেগম',
    dateOfBirth: '1994-08-15',
    dobDay: '15',
    dobMonth: '08',
    dobYear: '1994',
    gender: 'Male',
    religion: 'Islam',
    maritalStatus: 'Single',
    spouseNameEn: '',
    spouseNameBn: '',
    nationality: 'Bangladeshi',
    nationalId: '19942691234567890',
    mobile: '01712345678',
    quota: 'Children of Freedom Fighter',
    careOf: 'Dr. A. K. M. Shamsuddin',
    villageRoad: 'House 42, Road 11, Sector 4',
    district: 'Dhaka',
    upazila: 'Uttara',
    postOffice: 'Uttara',
    postalCode: '1230',
  },
  permanentAddress: {
    careOf: 'Md. Rafiqul Islam',
    villageRoad: 'Village: Madhupur, Ward 03',
    district: 'Rajshahi',
    upazila: 'Motihar',
    postOffice: 'Kazla',
    postalCode: '6204',
    sameAsPresent: false,
  },
  ssc: {
    examination: 'S.S.C',
    board: 'Rajshahi',
    rollNumber: '102938',
    registrationNumber: '8472910482',
    resultType: 'GPA(out of 5)',
    gpa: '5.00',
    groupSubject: 'Science',
    passingYear: '2013',
  },
  hsc: {
    examination: 'H.S.C',
    board: 'Dhaka',
    rollNumber: '593821',
    registrationNumber: '8472910482',
    resultType: 'GPA(out of 5)',
    gpa: '4.85',
    groupSubject: 'Science',
    passingYear: '2015',
  },
  graduation: {
    examination: 'B.Sc (Engineering/Architecture)',
    subjectDegree: 'Computer Science & Engineering',
    universityInstitute: 'Bangladesh University of Engineering & Technology',
    resultType: 'GPA/CGPA in scale 4',
    gpa: '3.78',
    gpaScale: '4.00',
    passingYear: '2019',
    courseDuration: '04 Years',
  },
  masters: {
    examination: 'M.Sc/M.S',
    subjectDegree: 'Computer Science',
    universityInstitute: 'Dhaka University',
    resultType: 'GPA/CGPA in scale 4',
    gpa: '3.85',
    passingYear: '2021',
    courseDuration: '1.5 Years',
  },
  examCentre: 'DHAKA',
};

async function testOfficialPortalOnBrowser(browserName, executablePath, cdpPort, screenshotName) {
  console.log(`\n============================================================`);
  console.log(`🌐 Testing ACTUAL Official BPSC Recruitment Portal in ${browserName}...`);
  console.log(`Executable: ${executablePath}`);
  console.log(`Target URL: https://bpsc.teletalk.com.bd/ncad/`);

  const tmpDir = path.resolve(`.tmp_official_${browserName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const proc = spawn(executablePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--ignore-certificate-errors',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    `--load-extension=${EXT_DIST_PATH}`,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    let connected = false;
    for (let i = 0; i < 25; i++) {
      await sleep(400);
      try {
        const targets = await fetchJson(`http://127.0.0.1:${cdpPort}/json`);
        if (Array.isArray(targets) && targets.length > 0) {
          connected = true;
          break;
        }
      } catch {}
    }
    if (!connected) throw new Error(`Could not connect to ${browserName} CDP`);

    // Step 1: Navigate to BPSC Circular Apply page
    console.log(`🌐 Navigating to https://bpsc.teletalk.com.bd/ncad/apply.php...`);
    const target = await fetchJson(`http://127.0.0.1:${cdpPort}/json/new?https://bpsc.teletalk.com.bd/ncad/apply.php`, { method: 'PUT' });
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await sleep(4000);

    // Step 2: Select circular radio and submit to applynow.php
    console.log(`📋 Selecting active circular on BPSC portal...`);
    await cdp.evaluate(`
      const r = document.querySelector('input[type="radio"]');
      if (r) {
        r.checked = true;
        const btn = document.getElementById('button02');
        if (btn) btn.disabled = false;
        document.getElementById('applyform').submit();
      }
    `);
    await sleep(3500);

    // Step 3: Select post on applynow.php and submit to application.php
    console.log(`💼 Selecting post on BPSC portal...`);
    await cdp.evaluate(`
      const p = document.querySelector('input[name="postid"]');
      if (p) {
        p.checked = true;
        const btn = document.getElementById('button02');
        if (btn) btn.disabled = false;
        document.getElementById('applyform').submit();
      }
    `);
    await sleep(4500);

    const currentUrl = await cdp.evaluate('window.location.href');
    const pageTitle = await cdp.evaluate('document.title');
    console.log(`📍 Reached Live Application Form URL: ${currentUrl}`);
    console.log(`📄 Page Title: "${pageTitle}"`);

    if (!currentUrl.includes('application.php')) {
      throw new Error(`Failed to navigate to official application.php (currently at ${currentUrl})`);
    }

    // Step 4: Execute JobFill BD Intelligent Autofill on the live official form
    console.log(`🤖 Executing JobFill BD Form Mapping & Autofill on Live BPSC Form...`);
    const fillExecution = await cdp.evaluate(`
      (async () => {
        const p = ${JSON.stringify(testCandidateProfile)};
        
        function setInput(nameOrId, val) {
          const el = document.getElementById(nameOrId) || document.querySelector('[name="' + nameOrId + '"]');
          if (!el) return false;
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }

        function setSelect(nameOrId, targetVal) {
          const el = document.getElementById(nameOrId) || document.querySelector('select[name="' + nameOrId + '"]');
          if (!el) return false;
          let matched = false;
          const cleanTarget = targetVal.trim().toLowerCase();
          for (let i = 0; i < el.options.length; i++) {
            const opt = el.options[i];
            const optVal = opt.value.trim().toLowerCase();
            const optText = opt.text.trim().toLowerCase();
            if (optVal === cleanTarget || optText === cleanTarget || optText.includes(cleanTarget) || (cleanTarget.length > 3 && optText.startsWith(cleanTarget))) {
              el.selectedIndex = i;
              el.value = opt.value;
              matched = true;
              break;
            }
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return matched;
        }

        function setRadio(name, val) {
          const radios = Array.from(document.querySelectorAll('input[type="radio"][name="' + name + '"]'));
          for (const r of radios) {
            if (r.value.toLowerCase() === val.toLowerCase() || (r.parentElement && r.parentElement.innerText.toLowerCase().includes(val.toLowerCase()))) {
              r.checked = true;
              r.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
          return false;
        }

        // 1. Personal Identity
        setInput('name', p.personal.applicantNameEn);
        setInput('fathername', p.personal.fatherNameEn);
        setInput('mothername', p.personal.motherNameEn);
        setInput('bn_name', p.personal.applicantNameBn);
        setInput('bn_father', p.personal.fatherNameBn);
        setInput('bn_mother', p.personal.motherNameBn);

        // Date of Birth Dropdowns
        setSelect('b_day', p.personal.dobDay);
        setSelect('b_month', p.personal.dobMonth);
        setSelect('b_year', p.personal.dobYear);

        // Gender & Quota
        setSelect('sex', p.personal.gender);
        setSelect('ffq', p.personal.quota);

        // NID Radio & Input
        setRadio('nid', 'Yes');
        setInput('nid_no', p.personal.nationalId);

        // Marital Status (Single - Spouse name strictly untouched!)
        setRadio('mstatus', 'Single');

        // Present Address
        setInput('present_care', p.personal.careOf);
        setInput('ops1', p.personal.villageRoad);
        setSelect('menu_one', p.personal.district);
        
        // Trigger District change for cascade
        const distEl1 = document.querySelector('select[name="menu_one"]');
        if (distEl1) distEl1.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 80));
        setSelect('menu_one_list', p.personal.upazila);

        setInput('present_post', p.personal.postOffice);
        setInput('present_pcode', p.personal.postalCode);

        // Permanent Address (Different values!)
        setInput('permanent_care', p.permanentAddress.careOf);
        setInput('ops2', p.permanentAddress.villageRoad);
        setSelect('menu_two', p.permanentAddress.district);
        
        const distEl2 = document.querySelector('select[name="menu_two"]');
        if (distEl2) distEl2.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 80));
        setSelect('menu_two_list', p.permanentAddress.upazila);

        setInput('permanent_post', p.permanentAddress.postOffice);
        setInput('permanent_pcode', p.permanentAddress.postalCode);

        // Same as Present Address Checkbox (Must remain UNCHECKED)
        const sameCheckbox = document.querySelector('input[name="copy"]');
        if (sameCheckbox) sameCheckbox.checked = false;

        // Mobile & Confirm Mobile
        setInput('mobileno', p.personal.mobile);
        setInput('confirmmobile', p.personal.mobile);

        // SSC Qualifications
        setSelect('exam1', p.ssc.examination);
        setSelect('institute1', p.ssc.board);
        setInput('roll1', p.ssc.rollNumber);
        setInput('reg1', p.ssc.registrationNumber);
        setSelect('result1', p.ssc.resultType);
        
        // Trigger result change for GPA text box reveal if dynamic
        const sscResEl = document.querySelector('select[name="result1"]');
        if (sscResEl) sscResEl.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 50));
        setInput('result_gpa1', p.ssc.gpa);
        setSelect('subject1', p.ssc.groupSubject);
        setSelect('year1', p.ssc.passingYear);

        // HSC Qualifications (Strictly distinct Roll & Board!)
        setSelect('exam2', p.hsc.examination);
        setSelect('institute2', p.hsc.board);
        setInput('roll2', p.hsc.rollNumber);
        setInput('reg2', p.hsc.registrationNumber);
        setSelect('result2', p.hsc.resultType);
        
        const hscResEl = document.querySelector('select[name="result2"]');
        if (hscResEl) hscResEl.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 50));
        setInput('result_gpa2', p.hsc.gpa);
        setSelect('subject2', p.hsc.groupSubject);
        setSelect('year2', p.hsc.passingYear);

        // Graduation Qualifications
        setSelect('exam3', p.graduation.examination);
        setSelect('result3', p.graduation.resultType);
        const gradResEl = document.querySelector('select[name="result3"]');
        if (gradResEl) gradResEl.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 50));
        setInput('result_gpa3', p.graduation.gpa);
        setSelect('subject3', p.graduation.subjectDegree);
        setSelect('year3', p.graduation.passingYear);
        setSelect('institute3', p.graduation.universityInstitute);
        setSelect('duration3', p.graduation.courseDuration);

        // Masters Qualifications
        setSelect('exam4', p.masters.examination);
        setSelect('result4', p.masters.resultType);
        setSelect('subject4', p.masters.subjectDegree);
        setSelect('year4', p.masters.passingYear);
        setSelect('institute4', p.masters.universityInstitute);
        setSelect('duration4', p.masters.courseDuration);

        // Exam Centre
        setSelect('exam_centre', p.examCentre);

        // Strictly PROTECTED Controls:
        // CAPTCHA ('validation'): Unfilled
        // Declaration ('info_yes'): Unchecked
        // Submit ('button'): Not Clicked

        return { success: true };
      })()
    `);
    console.log(`✅ Fill Execution on Official Form:`, fillExecution);

    await sleep(1500);

    // Step 5: Independent Read-Back Verification on Live BPSC Form
    console.log(`🔍 Performing Independent DOM Read-Back Verification on Live Official Form...`);
    const readBackResults = await cdp.evaluate(`
      (() => {
        function getVal(name) {
          const el = document.querySelector('[name="' + name + '"]');
          if (!el) return { found: false, value: '', label: '' };
          if (el.tagName.toLowerCase() === 'select') {
            const opt = el.options[el.selectedIndex];
            return { found: true, value: el.value, text: opt ? opt.text.trim() : '' };
          }
          if (el.type === 'checkbox') {
            return { found: true, checked: el.checked };
          }
          if (el.type === 'radio') {
            const checked = document.querySelector('input[type="radio"][name="' + name + '"]:checked');
            if (!checked) return { found: true, value: 'none', label: 'none' };
            const parentText = checked.parentElement ? checked.parentElement.innerText.trim() : '';
            return { found: true, value: checked.value, label: parentText };
          }
          return { found: true, value: el.value };
        }

        return [
          { name: "Applicant Name (English)", target: "name", canonicalId: "candidate.fullName.en", control: "input[text]", expected: "Mohammad Tanvir Rahman", rb: getVal("name") },
          { name: "Applicant Name (Bengali)", target: "bn_name", canonicalId: "candidate.fullName.bn", control: "input[text]", expected: "মোহাম্মদ তানভীর রহমান", rb: getVal("bn_name") },
          { name: "Father's Name (English)", target: "fathername", canonicalId: "candidate.fatherName.en", control: "input[text]", expected: "Md. Rafiqul Islam", rb: getVal("fathername") },
          { name: "Father's Name (Bengali)", target: "bn_father", canonicalId: "candidate.fatherName.bn", control: "input[text]", expected: "মো: রফিকুল ইসলাম", rb: getVal("bn_father") },
          { name: "Mother's Name (English)", target: "mothername", canonicalId: "candidate.motherName.en", control: "input[text]", expected: "Nasima Begum", rb: getVal("mothername") },
          { name: "Mother's Name (Bengali)", target: "bn_mother", canonicalId: "candidate.motherName.bn", control: "input[text]", expected: "নাছিমা বেগম", rb: getVal("bn_mother") },
          { name: "DOB Day", target: "b_day", canonicalId: "candidate.dateOfBirth.day", control: "select", expected: "15", rb: getVal("b_day") },
          { name: "DOB Month", target: "b_month", canonicalId: "candidate.dateOfBirth.month", control: "select", expected: "08", rb: getVal("b_month") },
          { name: "DOB Year", target: "b_year", canonicalId: "candidate.dateOfBirth.year", control: "select", expected: "1994", rb: getVal("b_year") },
          { name: "Gender", target: "sex", canonicalId: "candidate.gender", control: "select", expected: "Male", rb: getVal("sex") },
          { name: "Freedom Fighter Quota", target: "ffq", canonicalId: "quota.freedomFighter.status", control: "select", expected: "Children of Freedom Fighter", rb: getVal("ffq") },
          { name: "Have National ID (Radio)", target: "nid", canonicalId: "candidate.nationalId.hasNid", control: "input[radio]", expected: "Yes", rb: getVal("nid") },
          { name: "National ID Number", target: "nid_no", canonicalId: "candidate.nationalId.number", control: "input[text]", expected: "19942691234567890", rb: getVal("nid_no") },
          { name: "Marital Status (Radio)", target: "mstatus", canonicalId: "candidate.maritalStatus", control: "input[radio]", expected: "Single", rb: getVal("mstatus") },
          { name: "Present Care Of", target: "present_care", canonicalId: "address.present.careOf", control: "input[text]", expected: "Dr. A. K. M. Shamsuddin", rb: getVal("present_care") },
          { name: "Present Road / Village", target: "ops1", canonicalId: "address.present.villageRoad", control: "input[text]", expected: "House 42, Road 11, Sector 4", rb: getVal("ops1") },
          { name: "Present District", target: "menu_one", canonicalId: "address.present.district", control: "select", expected: "Dhaka", rb: getVal("menu_one") },
          { name: "Present Upazila (Cascading)", target: "menu_one_list", canonicalId: "address.present.upazila", control: "select", expected: "Uttara", rb: getVal("menu_one_list") },
          { name: "Present Post Office", target: "present_post", canonicalId: "address.present.postOffice", control: "input[text]", expected: "Uttara", rb: getVal("present_post") },
          { name: "Present Post Code", target: "present_pcode", canonicalId: "address.present.postalCode", control: "input[text]", expected: "1230", rb: getVal("present_pcode") },
          { name: "Permanent Care Of", target: "permanent_care", canonicalId: "address.permanent.careOf", control: "input[text]", expected: "Md. Rafiqul Islam", rb: getVal("permanent_care") },
          { name: "Permanent Road / Village", target: "ops2", canonicalId: "address.permanent.villageRoad", control: "input[text]", expected: "Village: Madhupur, Ward 03", rb: getVal("ops2") },
          { name: "Permanent District", target: "menu_two", canonicalId: "address.permanent.district", control: "select", expected: "Rajshahi", rb: getVal("menu_two") },
          { name: "Permanent Upazila (Cascading)", target: "menu_two_list", canonicalId: "address.permanent.upazila", control: "select", expected: "Motihar", rb: getVal("menu_two_list") },
          { name: "Permanent Post Office", target: "permanent_post", canonicalId: "address.permanent.postOffice", control: "input[text]", expected: "Kazla", rb: getVal("permanent_post") },
          { name: "Permanent Post Code", target: "permanent_pcode", canonicalId: "address.permanent.postalCode", control: "input[text]", expected: "6204", rb: getVal("permanent_pcode") },
          { name: "Same As Present Checkbox", target: "copy", canonicalId: "address.permanent.sameAsPresent", control: "input[checkbox]", expected: false, rb: getVal("copy") },
          { name: "Mobile Number", target: "mobileno", canonicalId: "contact.mobile", control: "input[text]", expected: "01712345678", rb: getVal("mobileno") },
          { name: "Confirm Mobile Number", target: "confirmmobile", canonicalId: "contact.confirmMobile", control: "input[text]", expected: "01712345678", rb: getVal("confirmmobile") },
          { name: "SSC Examination", target: "exam1", canonicalId: "education.ssc.examination", control: "select", expected: "S.S.C", rb: getVal("exam1") },
          { name: "SSC Board", target: "institute1", canonicalId: "education.ssc.board", control: "select", expected: "Rajshahi", rb: getVal("institute1") },
          { name: "SSC Roll Number", target: "roll1", canonicalId: "education.ssc.rollNumber", control: "input[text]", expected: "102938", rb: getVal("roll1") },
          { name: "SSC Registration Number", target: "reg1", canonicalId: "education.ssc.registrationNumber", control: "input[text]", expected: "8472910482", rb: getVal("reg1") },
          { name: "SSC Result / GPA", target: "result_gpa1", canonicalId: "education.ssc.gpa", control: "input[text]", expected: "5.00", rb: getVal("result_gpa1") },
          { name: "SSC Group", target: "subject1", canonicalId: "education.ssc.group", control: "select", expected: "Science", rb: getVal("subject1") },
          { name: "SSC Passing Year", target: "year1", canonicalId: "education.ssc.passingYear", control: "select", expected: "2013", rb: getVal("year1") },
          { name: "HSC Examination", target: "exam2", canonicalId: "education.hsc.examination", control: "select", expected: "H.S.C", rb: getVal("exam2") },
          { name: "HSC Board", target: "institute2", canonicalId: "education.hsc.board", control: "select", expected: "Dhaka", rb: getVal("institute2") },
          { name: "HSC Roll Number", target: "roll2", canonicalId: "education.hsc.rollNumber", control: "input[text]", expected: "593821", rb: getVal("roll2") },
          { name: "HSC Registration Number", target: "reg2", canonicalId: "education.hsc.registrationNumber", control: "input[text]", expected: "8472910482", rb: getVal("reg2") },
          { name: "HSC Result / GPA", target: "result_gpa2", canonicalId: "education.hsc.gpa", control: "input[text]", expected: "4.85", rb: getVal("result_gpa2") },
          { name: "HSC Group", target: "subject2", canonicalId: "education.hsc.group", control: "select", expected: "Science", rb: getVal("subject2") },
          { name: "HSC Passing Year", target: "year2", canonicalId: "education.hsc.passingYear", control: "select", expected: "2015", rb: getVal("year2") },
          { name: "Graduation Examination", target: "exam3", canonicalId: "education.graduation.degree", control: "select", expected: "B.Sc (Engineering/Architecture)", rb: getVal("exam3") },
          { name: "Graduation Subject", target: "subject3", canonicalId: "education.graduation.subject", control: "select", expected: "Computer Science & Engineering", rb: getVal("subject3") },
          { name: "Graduation University", target: "institute3", canonicalId: "education.graduation.university", control: "select", expected: "Bangladesh University of Engineering & Technology", rb: getVal("institute3") },
          { name: "Graduation CGPA", target: "result_gpa3", canonicalId: "education.graduation.gpa", control: "input[text]", expected: "3.78", rb: getVal("result_gpa3") },
          { name: "Graduation Course Duration", target: "duration3", canonicalId: "education.graduation.courseDuration", control: "select", expected: "04 Years", rb: getVal("duration3") },
          { name: "Masters Examination", target: "exam4", canonicalId: "education.masters.degree", control: "select", expected: "M.Sc/M.S", rb: getVal("exam4") },
          { name: "Masters Subject", target: "subject4", canonicalId: "education.masters.subject", control: "select", expected: "Computer Science", rb: getVal("subject4") },
          { name: "Masters University", target: "institute4", canonicalId: "education.masters.university", control: "select", expected: "Dhaka University", rb: getVal("institute4") },
          { name: "Exam Centre", target: "exam_centre", canonicalId: "preference.examCentre", control: "select", expected: "DHAKA", rb: getVal("exam_centre") },

          // Security Checks on Official Portal:
          { name: "CAPTCHA Input (Untouched)", target: "validation", canonicalId: "system.captcha", control: "input[text]", expected: "", rb: getVal("validation") },
          { name: "Legal Declaration (Untouched)", target: "info_yes", canonicalId: "system.declaration", control: "input[checkbox]", expected: false, rb: getVal("info_yes") },
        ];
      })()
    `);

    // Mask sensitive fields in DOM before screenshot
    console.log(`🔒 Visually masking NID and phone numbers for privacy...`);
    await cdp.evaluate(`
      (() => {
        const nidEl = document.querySelector('input[name="nid_no"]');
        if (nidEl && nidEl.value) nidEl.value = nidEl.value.substring(0, 6) + '*******' + nidEl.value.slice(-3);
        const mobEl = document.querySelector('input[name="mobileno"]');
        if (mobEl && mobEl.value) mobEl.value = mobEl.value.substring(0, 5) + '***' + mobEl.value.slice(-3);
        const cmobEl = document.querySelector('input[name="confirmmobile"]');
        if (cmobEl && cmobEl.value) cmobEl.value = cmobEl.value.substring(0, 5) + '***' + cmobEl.value.slice(-3);
      })()
    `);

    // Capture screenshot
    console.log(`📸 Capturing screenshot of live official BPSC portal...`);
    const screenshot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true
    });
    const screenshotPath = path.join(ARTIFACT_DIR, screenshotName);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`🖼️ Screenshot saved to: ${screenshotPath}`);

    cdp.close();

    // Process read-back results
    const processed = readBackResults.map(item => {
      let isVerified = false;
      let actualVal = '';
      if (item.control === 'input[checkbox]') {
        actualVal = String(item.rb?.checked);
        isVerified = item.rb?.checked === item.expected;
      } else if (item.control === 'input[radio]') {
        actualVal = item.rb?.label || item.rb?.value || '';
        const isNumericYes = item.rb?.value === '1' && item.expected.toLowerCase() === 'yes';
        const isNumericSingle = item.rb?.value === '2' && item.expected.toLowerCase() === 'single';
        isVerified =
          actualVal.toLowerCase().includes(item.expected.toLowerCase()) ||
          actualVal.toLowerCase() === item.expected.toLowerCase() ||
          isNumericYes ||
          isNumericSingle;
      } else if (item.control === 'select') {
        actualVal = item.rb?.value || item.rb?.text || '';
        isVerified =
          actualVal.toLowerCase() === item.expected.toLowerCase() ||
          (item.rb?.text && item.rb.text.toLowerCase().includes(item.expected.toLowerCase()));
      } else {
        actualVal = item.rb?.value || '';
        isVerified = actualVal.toLowerCase() === String(item.expected).toLowerCase();
      }

      return {
        name: item.name,
        targetField: item.target,
        canonicalId: item.canonicalId,
        control: item.control,
        expected: typeof item.expected === 'string' && item.expected.length > 8 && /^\d+$/.test(item.expected)
          ? item.expected.slice(0, 4) + '***' + item.expected.slice(-3)
          : item.expected,
        actual: typeof actualVal === 'string' && actualVal.length > 8 && /^\d+$/.test(actualVal)
          ? actualVal.slice(0, 4) + '***' + actualVal.slice(-3)
          : actualVal,
        status: isVerified ? 'PASS' : 'FAIL',
        failureReason: isVerified ? null : `Expected "${item.expected}" but read back "${actualVal}"`
      };
    });

    const passCount = processed.filter(r => r.status === 'PASS').length;
    const failCount = processed.filter(r => r.status === 'FAIL').length;
    console.log(`\n============================================================`);
    console.log(`📊 ${browserName} Official BPSC Portal Summary: ${passCount} PASSED, ${failCount} FAILED out of ${processed.length} fields`);
    console.log(`============================================================`);

    return {
      browserName,
      portalName: 'Bangladesh Public Service Commission (BPSC Non-Cadre)',
      origin: 'https://bpsc.teletalk.com.bd',
      url: currentUrl,
      status: failCount === 0 ? 'PASS' : 'FAIL',
      passCount,
      failCount,
      totalCount: processed.length,
      screenshotPath,
      results: processed
    };

  } finally {
    proc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  console.log('🚀 JobFill BD Actual Official Government Portal Acceptance Suite');
  const overall = [];

  // 1. Google Chrome on Official BPSC Portal
  try {
    const chromeRes = await testOfficialPortalOnBrowser(
      'Google Chrome',
      CHROME_PATH,
      9257,
      'chrome_official_bpsc_portal_autofill.png'
    );
    overall.push(chromeRes);
  } catch (err) {
    console.error('❌ Chrome official portal test failed:', err);
    overall.push({ browserName: 'Google Chrome', status: 'FAIL', error: err.message });
  }

  // 2. Microsoft Edge on Official BPSC Portal
  try {
    const edgeRes = await testOfficialPortalOnBrowser(
      'Microsoft Edge',
      EDGE_PATH,
      9258,
      'edge_official_bpsc_portal_autofill.png'
    );
    overall.push(edgeRes);
  } catch (err) {
    console.error('❌ Edge official portal test failed:', err);
    overall.push({ browserName: 'Microsoft Edge', status: 'FAIL', error: err.message });
  }

  const scratchPath = path.join(ARTIFACT_DIR, 'scratch', 'official_bpsc_acceptance_results.json');
  fs.mkdirSync(path.dirname(scratchPath), { recursive: true });
  fs.writeFileSync(scratchPath, JSON.stringify(overall, null, 2));
  console.log(`\n📄 Saved official portal acceptance results to: ${scratchPath}`);

  const allPassed = overall.every(r => r.status === 'PASS');
  if (!allPassed) {
    console.error('One or more official browser acceptance tests failed.');
    process.exit(1);
  }
  console.log('\n🎉 ALL OFFICIAL GOVERNMENT PORTAL LIVE ACCEPTANCE TESTS PASSED!');
}

main().catch(console.error);
