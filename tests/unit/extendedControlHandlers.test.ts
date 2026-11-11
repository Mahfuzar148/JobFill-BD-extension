import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  TextInputHandler,
  TextareaHandler,
  SelectHandler,
  RadioHandler,
  CheckboxHandler,
  DateHandler,
  ControlHandlerRouter,
} from '../../src/handlers';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { sampleDemoProfile } from '../../src/types/defaults';

describe('JobFill BD - Extended Form Control Handlers Test Suite', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
  });

  // 1. Text Input Handler
  describe('TextInputHandler', () => {
    it('sets input value and preserves framework compatibility without revert', async () => {
      document.body.innerHTML = `<input type="text" id="cand_name" name="cand_name">`;
      const input = document.getElementById('cand_name') as HTMLInputElement;

      // Simulate React _valueTracker
      let trackerVal = '';
      (input as any)._valueTracker = {
        getValue: () => trackerVal,
        setValue: (v: string) => { trackerVal = v; },
      };

      const handler = new TextInputHandler();
      expect(handler.canHandle(input)).toBe(true);

      const res = await handler.fill(input, 'MD. HASAN MAHMUD');
      expect(res.success).toBe(true);
      expect(input.value).toBe('MD. HASAN MAHMUD');
      expect(handler.isAlreadyCorrect(input, 'MD. HASAN MAHMUD')).toBe(true);
    });
  });

  // 2. Textarea Handler
  describe('TextareaHandler', () => {
    it('populates multi-line textarea and enforces maxLength limit', async () => {
      document.body.innerHTML = `<textarea id="job_desc" maxlength="20"></textarea>`;
      const textarea = document.getElementById('job_desc') as HTMLTextAreaElement;

      const handler = new TextareaHandler();
      expect(handler.canHandle(textarea)).toBe(true);

      const longText = 'Software Engineer responsible for web platforms and systems architecture';
      const res = await handler.fill(textarea, longText);

      expect(res.success).toBe(true);
      expect(textarea.value.length).toBeLessThanOrEqual(20);
      expect(textarea.value).toBe('Software Engineer re');
      expect(handler.verify(textarea, 'Software Engineer re')).toBe(true);
    });
  });

  // 3. Select Handler & Bilingual Equivalence
  describe('SelectHandler', () => {
    it('matches options by exact text, value, and bilingual Bengali-English equivalents', async () => {
      document.body.innerHTML = `
        <select id="sel_religion">
          <option value="">--Select--</option>
          <option value="1">ইসলাম (Islam)</option>
          <option value="2">হিন্দু (Hinduism)</option>
        </select>
      `;
      const select = document.getElementById('sel_religion') as HTMLSelectElement;
      const handler = new SelectHandler();

      expect(handler.canHandle(select)).toBe(true);
      expect(handler.getCurrentValue(select)).toBe(''); // Placeholder option returns empty

      const res = await handler.fill(select, 'Islam');
      expect(res.success).toBe(true);
      expect(select.value).toBe('1');
      expect(handler.isAlreadyCorrect(select, 'Islam')).toBe(true);
    });

    it('matches GPA scale dropdown options', async () => {
      document.body.innerHTML = `
        <select id="sel_gpa_scale">
          <option value="">Select Scale</option>
          <option value="scale_5">GPA (out of 5)</option>
          <option value="scale_4">GPA (out of 4)</option>
        </select>
      `;
      const select = document.getElementById('sel_gpa_scale') as HTMLSelectElement;
      const handler = new SelectHandler();

      const res = await handler.fill(select, '5.00');
      expect(res.success).toBe(true);
      expect(select.value).toBe('scale_5');
    });

    it('coordinates dependent cascading dropdowns sequentially', async () => {
      document.body.innerHTML = `
        <select id="parent_dist">
          <option value="">Select District</option>
          <option value="dhaka">Dhaka</option>
        </select>
        <select id="child_upazila">
          <option value="">Select Upazila</option>
        </select>
      `;
      const dist = document.getElementById('parent_dist') as HTMLSelectElement;
      const upazila = document.getElementById('child_upazila') as HTMLSelectElement;

      dist.addEventListener('change', () => {
        if (dist.value === 'dhaka') {
          upazila.innerHTML = `
            <option value="">Select Upazila</option>
            <option value="dhanmondi">Dhanmondi</option>
            <option value="gulshan">Gulshan</option>
          `;
        }
      });

      const success = await SelectHandler.fillCascadingPair(dist, 'Dhaka', upazila, 'Dhanmondi');
      expect(success).toBe(true);
      expect(dist.value).toBe('dhaka');
      expect(upazila.value).toBe('dhanmondi');
    });
  });

  // 4. Radio Group Handler
  describe('RadioHandler', () => {
    it('identifies radio groups by name and activates matching option', async () => {
      document.body.innerHTML = `
        <form>
          <div class="radio-wrap">
            <input type="radio" name="gender" id="g_m" value="M">
            <label for="g_m">Male (পুরুষ)</label>
          </div>
          <div class="radio-wrap">
            <input type="radio" name="gender" id="g_f" value="F">
            <label for="g_f">Female (মহিলা)</label>
          </div>
        </form>
      `;
      const radioM = document.getElementById('g_m') as HTMLInputElement;
      const radioF = document.getElementById('g_f') as HTMLInputElement;
      const handler = new RadioHandler();

      expect(handler.canHandle(radioM)).toBe(true);
      expect(handler.getCurrentValue(radioM)).toBe(''); // None checked

      const res = await handler.fill(radioM, 'Male');
      expect(res.success).toBe(true);
      expect(radioM.checked).toBe(true);
      expect(radioF.checked).toBe(false);
      expect(handler.isAlreadyCorrect(radioM, 'Male')).toBe(true);
      expect(handler.isAlreadyCorrect(radioM, 'Female')).toBe(false);
    });

    it('matches radio options using Bengali labels', async () => {
      document.body.innerHTML = `
        <label><input type="radio" name="marital" value="1"> অবিবাহিত</label>
        <label><input type="radio" name="marital" value="2"> বিবাহিত</label>
      `;
      const radio = document.querySelector<HTMLInputElement>('input[name="marital"]')!;
      const handler = new RadioHandler();

      const res = await handler.fill(radio, 'Single');
      expect(res.success).toBe(true);
      const checked = document.querySelector<HTMLInputElement>('input[name="marital"]:checked');
      expect(checked?.value).toBe('1');
    });
  });

  // 5. Checkbox Handler & Safety Policy
  describe('CheckboxHandler', () => {
    it('accurately checks Same as Present Address and Currently Working', async () => {
      document.body.innerHTML = `
        <input type="checkbox" id="same_as_present" name="same_as_present">
        <input type="checkbox" id="currently_working" name="currently_working">
      `;
      const cbSame = document.getElementById('same_as_present') as HTMLInputElement;
      const cbWork = document.getElementById('currently_working') as HTMLInputElement;
      const handler = new CheckboxHandler();

      expect(handler.canHandle(cbSame)).toBe(true);
      expect(cbSame.checked).toBe(false);

      const resSame = await handler.fill(cbSame, 'true');
      expect(resSame.success).toBe(true);
      expect(cbSame.checked).toBe(true);

      const resWork = await handler.fill(cbWork, '1');
      expect(resWork.success).toBe(true);
      expect(cbWork.checked).toBe(true);
    });

    it('STRICT SAFETY POLICY: NEVER auto-checks legal declaration or terms checkboxes', async () => {
      document.body.innerHTML = `
        <input type="checkbox" id="chk_declaration" name="declaration">
        <label for="chk_declaration">I declare that all information given above is true and correct.</label>
      `;
      const declarationCb = document.getElementById('chk_declaration') as HTMLInputElement;
      const handler = new CheckboxHandler();

      expect(handler.isDeclarationOrTermsCheckbox(declarationCb)).toBe(true);

      const res = await handler.fill(declarationCb, 'true');
      expect(res.success).toBe(false);
      expect(declarationCb.checked).toBe(false); // Must remain unchecked!
      expect(res.message).toContain('Safety Policy');
    });
  });

  // 6. Date Handler
  describe('DateHandler', () => {
    it('formats strict YYYY-MM-DD for native HTML5 date input', async () => {
      document.body.innerHTML = `<input type="date" id="native_dob" name="dob">`;
      const dateInput = document.getElementById('native_dob') as HTMLInputElement;
      const handler = new DateHandler();

      expect(handler.canHandle(dateInput)).toBe(true);

      const res = await handler.fill(dateInput, '1998-05-15');
      expect(res.success).toBe(true);
      expect(dateInput.value).toBe('1998-05-15');
    });

    it('formats DD-MM-YYYY for text-based date inputs with placeholder', async () => {
      document.body.innerHTML = `<input type="text" id="text_dob" name="dob" placeholder="DD-MM-YYYY">`;
      const textDateInput = document.getElementById('text_dob') as HTMLInputElement;
      const handler = new DateHandler();

      expect(handler.canHandle(textDateInput)).toBe(true);

      const res = await handler.fill(textDateInput, '1998-05-15');
      expect(res.success).toBe(true);
      expect(textDateInput.value).toBe('15-05-1998');
    });

    it('formats DD-MM-YY for 2-digit year length of service inputs', async () => {
      document.body.innerHTML = `<input type="text" id="service_start" name="service_start" placeholder="DD-MM-YY">`;
      const serviceInput = document.getElementById('service_start') as HTMLInputElement;
      const handler = new DateHandler();

      const res = await handler.fill(serviceInput, '2022-01-01');
      expect(res.success).toBe(true);
      expect(serviceInput.value).toBe('01-01-22');
    });
  });

  // 7. Full Integration Test on all-controls-test.html
  describe('End-to-End All Controls Local Test Page Integration', () => {
    it('scans and autofills all supported controls while strictly protecting declarations', async () => {
      const htmlPath = path.resolve(__dirname, '../../test-pages/all-controls-test.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      document.documentElement.innerHTML = html;

      // In JSDOM, innerHTML scripts are not auto-executed. Wire dependent listener for test:
      const distEl = (document.getElementById('present_district') || document.getElementById('district')) as HTMLSelectElement;
      const upazilaEl = (document.getElementById('present_upazila') || document.getElementById('upazila')) as HTMLSelectElement;
      distEl?.addEventListener('change', () => {
        if (distEl.value.toLowerCase() === 'dhaka') {
          upazilaEl.innerHTML = `
            <option value="">Select Upazila</option>
            <option value="mohammadpur">Mohammadpur</option>
            <option value="dhanmondi">Dhanmondi</option>
          `;
        }
      });

      // Scan page with sample profile
      const scanResult = await PageScanner.scanPage(sampleDemoProfile);

      expect(scanResult.totalVisibleInputs).toBeGreaterThanOrEqual(10);
      expect(scanResult.readyToFillCount).toBeGreaterThanOrEqual(6);

      // Verify declaration checkbox is NOT approved
      const declItem = scanResult.planItems.find((i) => i.selector.includes('declaration'));
      if (declItem) {
        expect(declItem.isApproved).toBe(false);
        expect(declItem.status).toBe('Unsupported Field');
      }

      // Execute Fill Plan
      const approvedItems = scanResult.planItems.filter((i) => i.isApproved);
      const sessionId = 'test_session_all_controls';
      const report = await VerificationEngine.executePlan(sessionId, approvedItems);

      expect(report.successfullyFilled).toBeGreaterThanOrEqual(6);
      expect(report.failedVerification).toBe(0);

      // Verify DOM values
      const applicantName = (document.getElementById('applicant_name') as HTMLInputElement).value;
      const jobDesc = (document.getElementById('job_description') as HTMLTextAreaElement).value;
      const religion = (document.getElementById('religion') as HTMLSelectElement).value;
      const radioM = document.getElementById('gender_male') as HTMLInputElement;
      const sameAddress = document.getElementById('same_as_present') as HTMLInputElement;
      const declaration = document.getElementById('declaration') as HTMLInputElement;
      const nativeDob = (document.getElementById('native_dob') as HTMLInputElement).value;
      const textDob = (document.getElementById('text_dob') as HTMLInputElement).value;

      expect(applicantName).toBe('MD. HASAN MAHMUD');
      expect(jobDesc).toBeTruthy();
      expect(religion).toBe('islam');
      expect(radioM.checked).toBe(true);
      expect(sameAddress.checked).toBe(true);
      expect(declaration.checked).toBe(false); // Safety policy verified!
      expect(nativeDob).toBe('1998-05-15');
      expect(textDob).toBe('15-05-1998');

      // Test Undo Functionality
      const undoResult = VerificationEngine.undoLastFill(sessionId);
      expect(undoResult.restoredCount).toBeGreaterThan(0);
    });
  });
});
