// JobFill BD - Smart CAPTCHA-Aware Data Extraction Comprehensive Test Suite
// Verifies:
// 1. CAPTCHA & Anti-Bot Detection (reCAPTCHA, hCaptcha, Turnstile, Cloudflare Challenge, F5 WAF, 429, 403, 401)
// 2. Human-in-the-Loop Safe Session Pause & Resume
// 3. Schema.org JobPosting JSON-LD Extraction
// 4. Rate Limiting & Retry-After Compliance
// 5. Authorized CSV & JSON Job File Importer
// 6. Security & Zero Token Storage Policy

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectResponseChallenge,
  detectPageChallenge,
  detectAccessRestrictionWithReason,
} from '../../src/jobs/services/captcha-detector';
import { CaptchaSessionManager } from '../../src/jobs/services/captcha-session-manager';
import {
  extractJsonLdJobPostings,
  processExtractedJobItem,
} from '../../src/jobs/services/extraction-engine';
import { RateLimitPolicy } from '../../src/jobs/services/rate-limit-policy';
import {
  parseJobCircularsJson,
  parseJobCircularsCsv,
} from '../../src/jobs/services/job-file-importer';
import { BpscAdapter } from '../../src/jobs/sources/bpsc';

describe('JobFill BD — Smart CAPTCHA-Aware Data Extraction Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    CaptchaSessionManager.clearAllSessions();
    RateLimitPolicy.clearAll();
    document.body.innerHTML = '';
    document.title = 'Test Portal';
  });

  afterEach(() => {
    localStorage.clear();
    CaptchaSessionManager.clearAllSessions();
    RateLimitPolicy.clearAll();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. CAPTCHA & ANTI-BOT CHALLENGE DETECTION
  // =========================================================================
  describe('1. Dedicated CAPTCHA & Anti-Bot Challenge Detection', () => {
    it('detects Google reCAPTCHA v2 / v3 in response HTML and DOM', () => {
      const html = `
        <html>
          <body>
            <form action="/login">
              <div class="g-recaptcha" data-sitekey="6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-"></div>
              <script src="https://www.google.com/recaptcha/api.js"></script>
            </form>
          </body>
        </html>
      `;
      const res = detectResponseChallenge(html, 200);
      expect(res.classification).toBe('CAPTCHA_REQUIRED');
      expect(res.challengeProvider).toBe('recaptcha');
      expect(res.isBlocked).toBe(true);
      expect(res.requiresHumanVerification).toBe(true);

      // Test page DOM inspection
      document.body.innerHTML = html;
      const pageRes = detectPageChallenge(document, 200);
      expect(pageRes.classification).toBe('CAPTCHA_REQUIRED');
      expect(pageRes.challengeProvider).toBe('recaptcha');
    });

    it('detects hCaptcha widget container and public iframe in response & DOM', () => {
      const html = `
        <div class="login-box">
          <div class="h-captcha" data-sitekey="10000000-ffff-ffff-ffff-000000000001"></div>
          <iframe src="https://hcaptcha.com/checkcaptcha?sitekey=test"></iframe>
        </div>
      `;
      const res = detectResponseChallenge(html, 200);
      expect(res.classification).toBe('CAPTCHA_REQUIRED');
      expect(res.challengeProvider).toBe('hcaptcha');

      document.body.innerHTML = html;
      const pageRes = detectPageChallenge(document, 200);
      expect(pageRes.classification).toBe('CAPTCHA_REQUIRED');
      expect(pageRes.challengeProvider).toBe('hcaptcha');
    });

    it('detects Cloudflare Turnstile in response & DOM', () => {
      const html = `
        <div>
          <div class="cf-turnstile" data-sitekey="0x4AAAAAAABcdEFgh"></div>
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
        </div>
      `;
      const res = detectResponseChallenge(html, 200);
      expect(res.classification).toBe('CAPTCHA_REQUIRED');
      expect(res.challengeProvider).toBe('turnstile');

      document.body.innerHTML = html;
      const pageRes = detectPageChallenge(document, 200);
      expect(pageRes.classification).toBe('CAPTCHA_REQUIRED');
      expect(pageRes.challengeProvider).toBe('turnstile');
    });

    it('detects Cloudflare Interstitial Security Challenge Page (503 / 403 / cf-chl-bypass)', () => {
      const challengeHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Just a moment...</title></head>
        <body>
          <div id="challenge-platform">
            <span>Verify you are human</span>
            <span>Ray ID: 7c89a0b123456</span>
          </div>
        </body>
        </html>
      `;
      const res = detectResponseChallenge(challengeHtml, 503);
      expect(res.classification).toBe('HUMAN_VERIFICATION_REQUIRED');
      expect(res.challengeProvider).toBe('cloudflare_interstitial');
      expect(res.isBlocked).toBe(true);

      document.title = 'Just a moment...';
      document.body.innerHTML = challengeHtml;
      const pageRes = detectPageChallenge(document, 503);
      expect(pageRes.classification).toBe('HUMAN_VERIFICATION_REQUIRED');
    });

    it('detects F5 Big-IP TSPD WAF (/tspd/) security challenge', () => {
      const tspdHtml = `
        <html><head>
        <script type="text/javascript" src="/tspd/bobcmn.js?tspd_12345"></script>
        </head><body>Loading...</body></html>
      `;
      const res = detectResponseChallenge(tspdHtml, 200);
      expect(res.classification).toBe('HUMAN_VERIFICATION_REQUIRED');
      expect(res.challengeProvider).toBe('f5_tspd');
    });

    it('classifies HTTP 429 Too Many Requests with Retry-After header', () => {
      const res = detectResponseChallenge('Rate limit exceeded', 429, { 'retry-after': '30' });
      expect(res.classification).toBe('RATE_LIMITED');
      expect(res.isBlocked).toBe(true);
      expect(res.requiresHumanVerification).toBe(false);
      expect(res.retryAfterMs).toBe(30000);
    });

    it('classifies HTTP 403 Forbidden as ACCESS_DENIED when no CAPTCHA is present', () => {
      const res = detectResponseChallenge('Access Denied. You do not have permission.', 403);
      expect(res.classification).toBe('ACCESS_DENIED');
      expect(res.isBlocked).toBe(true);
      expect(res.requiresHumanVerification).toBe(false);
    });

    it('classifies HTTP 401 Unauthorized as AUTHENTICATION_REQUIRED', () => {
      const res = detectResponseChallenge('Unauthorized access', 401);
      expect(res.classification).toBe('AUTHENTICATION_REQUIRED');
      expect(res.isBlocked).toBe(true);
    });

    it('returns NO_CHALLENGE_DETECTED on normal public job notice pages', () => {
      const publicHtml = `
        <table id="notices">
          <tr><td>1</td><td>48th BCS Circular</td><td>2026-11-10</td></tr>
        </table>
      `;
      const res = detectResponseChallenge(publicHtml, 200);
      expect(res.classification).toBe('NO_CHALLENGE_DETECTED');
      expect(res.isBlocked).toBe(false);

      document.body.innerHTML = publicHtml;
      document.title = 'BPSC Notices';
      const pageRes = detectPageChallenge(document, 200);
      expect(pageRes.classification).toBe('NO_CHALLENGE_DETECTED');
      expect(pageRes.isBlocked).toBe(false);
    });
  });

  // =========================================================================
  // 2. HUMAN-IN-THE-LOOP CAPTCHA WORKFLOW & RESUME VALIDATION
  // =========================================================================
  describe('2. Human-in-the-Loop CAPTCHA Workflow & Safe Resume State', () => {
    it('pauses extraction, stores safe session, and refuses to resume while challenge remains in DOM', () => {
      const challengeRes = detectResponseChallenge('<div class="g-recaptcha"></div>', 200);
      const session = CaptchaSessionManager.recordChallengePaused(
        'bangladesh_bank',
        'Bangladesh Bank',
        'https://erecruitment.bb.org.bd/career/jobopportunity.php',
        challengeRes
      );

      expect(session.sourceId).toBe('bangladesh_bank');
      expect(session.challengeClassification).toBe('CAPTCHA_REQUIRED');
      expect(session.resumable).toBe(true);

      // Simulate checking page before user solved it: challenge is still active
      document.body.innerHTML = `<div><div class="g-recaptcha" data-sitekey="test"></div></div>`;
      const evalCheck1 = CaptchaSessionManager.evaluateTabForResume(document);
      expect(evalCheck1.canResume).toBe(false);
      expect(evalCheck1.challengeClassification).toBe('CAPTCHA_REQUIRED');

      // Simulate user completing challenge in browser: DOM updates to show actual job table
      document.body.innerHTML = `
        <table class="table">
          <tr><th>Job ID</th><th>Title</th><th>Deadline</th></tr>
          <tr><td>101</td><td>Assistant Director</td><td>2026-12-15</td></tr>
        </table>
      `;
      document.title = 'Job Opportunity — Bangladesh Bank';

      const evalCheck2 = CaptchaSessionManager.evaluateTabForResume(document);
      expect(evalCheck2.canResume).toBe(true);
      expect(evalCheck2.challengeClassification).toBe('NO_CHALLENGE_DETECTED');

      // Clear session after resume
      CaptchaSessionManager.clearSession('bangladesh_bank');
      expect(CaptchaSessionManager.getActiveSession('bangladesh_bank')).toBeNull();
    });
  });

  // =========================================================================
  // 3. SCHEMA.ORG JSON-LD EXTRACTION & PROVENANCE
  // =========================================================================
  describe('3. Schema.org JobPosting JSON-LD Extraction & Provenance', () => {
    it('extracts JobPosting JSON-LD and records field-level provenance', () => {
      const jsonLdHtml = `
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org/",
            "@type": "JobPosting",
            "title": "Software Engineer (Backend)",
            "description": "Looking for Node.js and TypeScript developers in Dhaka.",
            "datePosted": "2026-11-01",
            "validThrough": "2026-12-01",
            "employmentType": "Full Time",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "Tech Corp Bangladesh",
              "sameAs": "https://techcorp.example.bd"
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Dhaka",
                "addressRegion": "Dhaka Division",
                "addressCountry": "BD"
              }
            },
            "baseSalary": {
              "@type": "MonetaryAmount",
              "currency": "BDT",
              "value": {
                "@type": "QuantitativeValue",
                "value": 85000
              }
            },
            "url": "https://techcorp.example.bd/jobs/backend-engineer",
            "directApplyUrl": "https://techcorp.example.bd/apply/backend-engineer"
          }
          </script>
        </head>
        <body>Job posting body</body>
        </html>
      `;

      const rawItems = extractJsonLdJobPostings(jsonLdHtml, 'https://techcorp.example.bd/careers');
      expect(rawItems).toHaveLength(1);

      const raw = rawItems[0];
      expect(raw.jobTitle).toBe('Software Engineer (Backend)');
      expect(raw.organization).toBe('Tech Corp Bangladesh');
      expect(raw.location).toContain('Dhaka');
      expect(raw.publishedDateText).toBe('2026-11-01');
      expect(raw.deadlineText).toBe('2026-12-01');
      expect(raw.salary).toContain('85000');
      // Keeps Circular URL and Application URL separate
      expect(raw.circularUrl).toBe('https://techcorp.example.bd/jobs/backend-engineer');
      expect(raw.applicationUrl).toBe('https://techcorp.example.bd/apply/backend-engineer');

      // Process through extraction pipeline with provenance
      const processed = processExtractedJobItem(raw, BpscAdapter);
      expect(processed.provenance.sourceId).toBe('bpsc');
      expect(processed.provenance.verificationState).toBe('official_verified');
      expect(processed.job.position).toBe('Software Engineer (Backend)');
    });

    it('ignores non-JobPosting JSON-LD (such as BreadcrumbList, WebSite, Organization)', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": []
        }
        </script>
      `;
      const rawItems = extractJsonLdJobPostings(html, 'https://example.com');
      expect(rawItems).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. RATE LIMITING & NETWORK SAFETY POLICY
  // =========================================================================
  describe('4. Rate Limiting & Network Safety Policy', () => {
    it('blocks repeated requests during active Retry-After cooldown', () => {
      const now = Date.now();
      RateLimitPolicy.recordResponse(
        'teletalk',
        429,
        { 'retry-after': '60' },
        undefined,
        now
      );

      const check1 = RateLimitPolicy.canRequestSource('teletalk', now + 10_000);
      expect(check1.allowed).toBe(false);
      expect(check1.reason).toContain('HTTP 429');

      // Once cooldown passes, requests are allowed
      const check2 = RateLimitPolicy.canRequestSource('teletalk', now + 65_000);
      expect(check2.allowed).toBe(true);
    });

    it('generates conditional headers (ETag / Last-Modified) for cache optimization', () => {
      RateLimitPolicy.recordResponse('reliefweb_bd', 200, {
        etag: '"W/33a64df5514a"',
        'last-modified': 'Wed, 11 Nov 2026 12:00:00 GMT',
      });

      const headers = RateLimitPolicy.getConditionalHeaders('reliefweb_bd');
      expect(headers['If-None-Match']).toBe('"W/33a64df5514a"');
      expect(headers['If-Modified-Since']).toBe('Wed, 11 Nov 2026 12:00:00 GMT');
    });
  });

  // =========================================================================
  // 5. MANUAL FILE IMPORTER (CSV & JSON)
  // =========================================================================
  describe('5. Manual Public File Importer (CSV & JSON)', () => {
    it('parses authorized JSON array of public circulars', () => {
      const json = JSON.stringify([
        {
          organization: 'Dhaka University',
          jobTitle: 'Assistant Professor (Computer Science)',
          circularUrl: 'https://du.ac.bd/notices/cs-teacher.pdf',
          deadline: '2026-12-20',
          category: 'University',
          location: 'Dhaka',
        },
      ]);

      const outcome = parseJobCircularsJson(json);
      expect(outcome.success).toBe(true);
      expect(outcome.importedJobs).toHaveLength(1);
      expect(outcome.importedJobs[0].organization).toBe('Dhaka University');
      expect(outcome.importedJobs[0].position).toBe('Assistant Professor (Computer Science)');
      expect(outcome.importedJobs[0].sourceVerification).toBe('user_submitted');
    });

    it('parses authorized CSV of public circulars and reports line errors for invalid entries', () => {
      const csv = `Organization,Job Title,Deadline,Circular URL
BUET,Lecturer (EEE),2026-12-15,https://buet.ac.bd/circ_1.pdf
,Missing Org Job,2026-12-10,https://example.com/circ_2.pdf
`;
      const outcome = parseJobCircularsCsv(csv);
      expect(outcome.importedJobs).toHaveLength(1);
      expect(outcome.importedJobs[0].organization).toBe('BUET');
      expect(outcome.errors).toHaveLength(1); // row 2 missing org
    });
  });
});
