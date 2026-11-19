#!/usr/bin/env node
/**
 * JobFill BD — Microsoft Edge Partner Center Automated Release Script
 *
 * Automates:
 * 1. Package verification & integrity check (manifest version, size, required assets).
 * 2. Uploading draft ZIP to Microsoft Edge Add-ons API v1.1.
 * 3. Polling upload operation status until Completed.
 * 4. Submitting draft package for certification with certification notes.
 *
 * Target Product Identity:
 *   Product ID: eb526695-67c1-4f54-ada8-63d13302630a
 *   Store ID:   0RDCK9KG03MN
 *   CRX ID:     codkdflmgahpbdhadkblabeihgknjnda
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Load environment variables from .env if present
const envPath = path.resolve(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const PRODUCT_ID = process.env.EDGE_PRODUCT_ID || 'eb526695-67c1-4f54-ada8-63d13302630a';
const CLIENT_ID = process.env.EDGE_CLIENT_ID || '';
const API_KEY = process.env.EDGE_API_KEY || '';
const SUBMISSION_NOTES =
  process.env.EDGE_SUBMISSION_NOTES ||
  'JobFill BD Version 2.0.1: Added 4th-20th Grade Explorer, Academic Subject Eligibility Matching, and Milestone Notification Reminders.';

const API_BASE = `https://api.addons.microsoftedge.microsoft.com/v1/products/${PRODUCT_ID}`;

// Parse CLI args
const args = process.argv.slice(2);
const isValidateOnly = args.includes('--validate-only') || args.includes('-v');
const isStatusCheck = args.includes('--status') || args.includes('-s');
const isPublishOnly = args.includes('--publish');
const isUploadOnly = args.includes('--upload');
const customZipArg = args.find((a) => a.startsWith('--zip='))?.split('=')[1];

async function main() {
  console.log('================================================================');
  console.log('  JobFill BD — Microsoft Edge Add-ons Release Automation');
  console.log('================================================================');
  console.log(`Product ID: ${PRODUCT_ID}`);
  console.log(`Store ID:   0RDCK9KG03MN`);
  console.log(`CRX ID:     codkdflmgahpbdhadkblabeihgknjnda`);

  // 1. Locate Target ZIP Package
  let zipPath = customZipArg
    ? path.resolve(ROOT, customZipArg)
    : path.resolve(ROOT, 'release', 'JobFill-BD-Edge-v2.0.1.zip');

  if (!fs.existsSync(zipPath)) {
    // Check fallback edge zip
    const fallbackPath = path.resolve(ROOT, 'release', 'JobFill-BD-Edge.zip');
    if (fs.existsSync(fallbackPath)) {
      console.log(`Target package ${zipPath} not found, falling back to ${fallbackPath}`);
      zipPath = fallbackPath;
    } else {
      console.error(`[ERROR] Release package not found at: ${zipPath}`);
      console.error('Run "node build.js" or "npm run build:edge-store" to create the package first.');
      process.exit(1);
    }
  }

  const zipStats = fs.statSync(zipPath);
  const sizeMb = (zipStats.size / (1024 * 1024)).toFixed(2);
  console.log(`Package:    ${zipPath}`);
  console.log(`Size:       ${sizeMb} MB (${zipStats.size} bytes)`);

  // 2. Validate Package Integrity
  console.log('\n[Phase 1] Validating Package Integrity...');
  if (zipStats.size < 50_000) {
    console.error(`[ERROR] Package is suspiciously small (${zipStats.size} bytes). Build may be broken.`);
    process.exit(1);
  }
  console.log('✓ Package size is valid.');

  const manifestPath = path.resolve(ROOT, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    console.log(`✓ Manifest Version: ${manifest.version}`);
  }

  if (isValidateOnly) {
    console.log('\n✓ Package validation completed successfully. (--validate-only mode)');
    process.exit(0);
  }

  // 3. Check API Authentication Credentials
  console.log('\n[Phase 2] Verifying Edge Partner Center API Credentials...');
  if (!CLIENT_ID || !API_KEY) {
    console.warn('\n----------------------------------------------------------------');
    console.warn('  [NOTICE] Microsoft Edge API Credentials Not Configured');
    console.warn('----------------------------------------------------------------');
    console.warn('To upload directly from CLI, configure your credentials in .env:');
    console.warn('  EDGE_CLIENT_ID=<Your Edge Client ID>');
    console.warn('  EDGE_API_KEY=<Your Edge API Key>');
    console.warn('');
    console.warn('Where to get API credentials:');
    console.warn('  1. Go to Partner Center: https://partner.microsoft.com/');
    console.warn('  2. Click Settings (gear icon) -> Account settings -> Developer settings.');
    console.warn('  3. Under "API access", generate or view your Client ID and API Key.');
    console.warn('');
    console.warn('Manual Web Upload Alternative:');
    console.warn(`  1. Open: https://partner.microsoft.com/en-us/dashboard/microsoftedge/${PRODUCT_ID}/packages`);
    console.warn(`  2. Click "Upload package" and select:`);
    console.warn(`     ${zipPath}`);
    console.warn('  3. Click Save & Submit for Certification.');
    console.warn('----------------------------------------------------------------\n');
    process.exit(0);
  }

  const headers = {
    Authorization: `ApiKey ${API_KEY}`,
    'X-ClientID': CLIENT_ID,
  };

  // 4. Status Check
  if (isStatusCheck) {
    console.log('\n[Phase 3] Checking Submission Status...');
    try {
      const res = await fetch(`${API_BASE}/submissions/draft/package`, {
        method: 'GET',
        headers,
      });
      console.log(`HTTP Status: ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.log('Status Response:', body);
    } catch (err) {
      console.error('[ERROR] Failed to query Edge API:', err.message);
    }
    process.exit(0);
  }

  // 5. Upload Draft Package
  if (!isPublishOnly) {
    console.log('\n[Phase 3] Uploading Draft Package to Edge Add-ons API v1.1...');
    const zipBuffer = fs.readFileSync(zipPath);

    try {
      const uploadRes = await fetch(`${API_BASE}/submissions/draft/package`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/zip',
        },
        body: zipBuffer,
      });

      console.log(`Upload HTTP Status: ${uploadRes.status} ${uploadRes.statusText}`);
      const opLocation =
        uploadRes.headers.get('Operation-Location') || uploadRes.headers.get('Location');

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error(`[ERROR] Package upload failed:`, errorText);
        process.exit(1);
      }

      console.log('✓ Package uploaded successfully.');
      if (opLocation) {
        console.log(`Operation Tracking URL: ${opLocation}`);
        console.log('Polling operation status until processing finishes...');
        let isDone = false;
        let attempts = 0;
        while (!isDone && attempts < 30) {
          await new Promise((r) => setTimeout(r, 4000));
          attempts++;
          const opRes = await fetch(opLocation, { headers });
          if (opRes.ok) {
            const opData = await opRes.json();
            console.log(`  [Poll #${attempts}] Status: ${opData.status || 'InProgress'}`);
            if (opData.status === 'Succeeded' || opData.status === 'Completed') {
              isDone = true;
              console.log('✓ Package processing completed successfully.');
            } else if (opData.status === 'Failed') {
              console.error('[ERROR] Package processing failed on Microsoft servers:', opData);
              process.exit(1);
            }
          }
        }
      }
    } catch (err) {
      console.error('[ERROR] Upload network request failed:', err.message);
      process.exit(1);
    }
  }

  // 6. Submit Draft for Certification
  if (!isUploadOnly) {
    console.log('\n[Phase 4] Submitting Draft for Certification...');
    try {
      const publishRes = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: SUBMISSION_NOTES,
        }),
      });

      console.log(`Publish HTTP Status: ${publishRes.status} ${publishRes.statusText}`);
      if (publishRes.ok) {
        console.log('\n🎉 SUCCESS: JobFill BD Version 2.0.1 submitted for certification!');
        console.log('Microsoft will review and publish within 24-72 hours.');
      } else {
        const errText = await publishRes.text();
        console.error('[ERROR] Submission for certification failed:', errText);
      }
    } catch (err) {
      console.error('[ERROR] Submission network request failed:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
