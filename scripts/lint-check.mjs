import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const srcDir = path.resolve(process.cwd(), 'src');

function collectTsFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectTsFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = collectTsFiles(srcDir);
const violations = [];

const ALLOWED_READONLY_FETCH_FILES = [
  path.normalize(path.join('src', 'jobs', 'services', 'job-fetcher.ts')),
  path.normalize(path.join('src', 'jobs', 'sources')),
  path.normalize(path.join('src', 'cloud', 'public-jobs-client.ts')),
];

const ALLOWED_OPTIN_CLOUD_FILES = [
  path.normalize(path.join('src', 'cloud', 'supabase-auth.ts')),
  path.normalize(path.join('src', 'cloud', 'encrypted-sync-service.ts')),
];

function isAllowedJobFetchFile(relPath) {
  const norm = path.normalize(relPath);
  return ALLOWED_READONLY_FETCH_FILES.some((allowed) => norm === allowed || norm.startsWith(allowed + path.sep));
}

function isAllowedCloudSyncFile(relPath) {
  const norm = path.normalize(relPath);
  return ALLOWED_OPTIN_CLOUD_FILES.some((allowed) => norm === allowed || norm.startsWith(allowed + path.sep));
}

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // 1. Disallow eval() and new Function()
    if (/\beval\s*\(/.test(line) || /\bnew\s+Function\s*\(/.test(line)) {
      violations.push(`${rel}:${lineNum} — Disallowed dynamic code execution (eval/Function)`);
    }
    // 2. Disallow external network transmission (XMLHttpRequest/navigator.sendBeacon) in src/
    if (/\bXMLHttpRequest\b|\bnavigator\.sendBeacon\b/.test(line)) {
      violations.push(`${rel}:${lineNum} — Disallowed external transmission call`);
    }
    if (/\bfetch\s*\(/.test(line) && !line.includes('blob:') && !line.includes('dataUrl')) {
      if (!isAllowedJobFetchFile(rel) && !isAllowedCloudSyncFile(rel)) {
        violations.push(`${rel}:${lineNum} — Unexpected network fetch() call outside approved read-only job sources or opt-in cloud modules`);
      }
    }
    if (isAllowedJobFetchFile(rel) && /method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/i.test(line)) {
      violations.push(`${rel}:${lineNum} — Job source fetcher must be read-only GET (no POST/PUT/PATCH/DELETE)`);
    }
    if (/\b(?:AIza[0-9A-Za-z_-]{20,}|sk-(?:proj-|live-)?[0-9A-Za-z]{20,})\b/.test(line)) {
      violations.push(`${rel}:${lineNum} — Disallowed embedded API key literal in extension bundle`);
    }
    if (/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[^'"`\s]+service_role/i.test(line)) {
      violations.push(`${rel}:${lineNum} — Disallowed embedded Supabase service_role JWT secret in client bundle`);
    }
    // Disallow intercepting WebRTC / Media device APIs (protects Google Meet and conferencing compatibility)
    if (/\b(getUserMedia|getDisplayMedia|RTCPeerConnection|MediaStream|AudioContext|webkitAudioContext)\b/.test(line)) {
      violations.push(`${rel}:${lineNum} — Disallowed WebRTC/Media API access/override`);
    }
    if (/\b(window|globalThis)\.(fetch|XMLHttpRequest)\s*=|XMLHttpRequest\.prototype\b|chrome\.scripting\.registerContentScripts\b/.test(line)) {
      violations.push(`${rel}:${lineNum} — Disallowed global API monkey-patch or dynamic script registration`);
    }
    // 3. Ensure console.* never prints passwords, NID, or document bytes/dataUrl
    if (/console\.(log|info|warn|debug)\s*\([^)]*(password|secret|nid|dataUrl|encryptedPayload)/i.test(line)) {
      violations.push(`${rel}:${lineNum} — Potential sensitive data logging detected`);
    }
  });
}

// Verify manifest.json enforces least-privilege permissions & excludes Google Meet
const manifestPath = path.resolve(process.cwd(), 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const manifestObj = JSON.parse(manifestRaw);
  const hostPerms = manifestObj.host_permissions || [];
  if (hostPerms.includes('<all_urls>')) {
    violations.push('manifest.json — Disallowed broad <all_urls> in host_permissions');
  }
  const contentScripts = manifestObj.content_scripts || [];
  for (const cs of contentScripts) {
    if ((cs.matches || []).includes('<all_urls>')) {
      violations.push('manifest.json — Disallowed <all_urls> in content_scripts.matches');
    }
    if (!(cs.exclude_matches || []).includes('*://meet.google.com/*')) {
      violations.push('manifest.json — Missing *://meet.google.com/* in content_scripts.exclude_matches');
    }
    if (!(cs.exclude_matches || []).includes('*://zoom.us/*') || !(cs.exclude_matches || []).includes('*://*.zoom.us/*')) {
      violations.push('manifest.json — Missing *://zoom.us/* or *://*.zoom.us/* in content_scripts.exclude_matches');
    }
  }
  for (const war of manifestObj.web_accessible_resources || []) {
    if ((war.matches || []).includes('<all_urls>')) {
      violations.push('manifest.json — Disallowed <all_urls> in web_accessible_resources.matches');
    }
  }
}

console.log(`Lint security & static check scanned ${files.length} source files...`);

if (violations.length > 0) {
  console.error('Lint violations found:');
  violations.forEach((v) => console.error('  ✗ ' + v));
  process.exit(1);
}

// Also run strict TypeScript check (unused locals & switch exhaustiveness)
try {
  execSync('npx tsc --noEmit --noFallthroughCasesInSwitch', { stdio: 'inherit' });
} catch {
  process.exit(1);
}

console.log('✅ All lint and static checks passed cleanly.');
