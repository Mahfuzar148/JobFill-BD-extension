import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argTarget = process.argv.find((a) => a.startsWith('--target='))?.split('=')[1];
const isChromeStore = process.argv.includes('--chrome-store') || argTarget === 'chrome';
const isEdgeStore =
  process.argv.includes('--edge-store') ||
  argTarget === 'edge' ||
  process.env.JOBFILL_STORE_CLEAN === '1' ||
  process.env.JOBFILL_STORE_CLEAN === 'true';
const isStoreClean = isChromeStore || isEdgeStore;
// Option A Local-Only First Public Release (v2.0.0): keep Cloud Sync disabled across
// ALL first-release builds (dist/, Chrome Store, Edge Store) unless explicitly enabled in a future version.
const isCloudSyncDisabled = process.env.JOBFILL_ENABLE_CLOUD_SYNC !== '1';

const outDir = isChromeStore
  ? path.resolve(__dirname, 'release', 'chrome', 'unpacked')
  : isEdgeStore
    ? path.resolve(__dirname, 'release', 'edge', 'unpacked')
    : path.resolve(__dirname, 'dist');

async function buildExtension() {
  console.log(
    isChromeStore
      ? '🛡️ Building Clean Google Chrome Web Store Bundle (__JOBFILL_STORE_CLEAN__=true)...'
      : isEdgeStore
        ? '🛡️ Building Clean Microsoft Edge Add-ons Store Bundle (__JOBFILL_STORE_CLEAN__=true)...'
        : '🚀 Building JobFill BD Chrome/Edge Extension...'
  );

  const defineConstants = {
    __JOBFILL_STORE_CLEAN__: JSON.stringify(isStoreClean),
    __JOBFILL_CLOUD_SYNC_DISABLED__: JSON.stringify(isCloudSyncDisabled),
  };

  // 1. Build React Dashboard & Extension Popup
  console.log('📦 Step 1: Building Dashboard & Extension Popup SPAs...');
  await build({
    configFile: false,
    plugins: [react()],
    define: defineConstants,
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          dashboard: path.resolve(__dirname, 'dashboard.html'),
          popup: path.resolve(__dirname, 'popup.html'),
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('react')) return 'vendor-react';
              return 'vendor';
            }
            if (id.includes(`${path.sep}src${path.sep}jobs${path.sep}`) || id.includes('/src/jobs/')) {
              return 'jobs-hub';
            }
          },
        },
      },
    },
  });

  // 2. Build Background Service Worker (IIFE standalone)
  console.log('📦 Step 2: Building Background Service Worker...');
  await build({
    configFile: false,
    define: defineConstants,
    build: {
      outDir,
      emptyOutDir: false,
      sourcemap: false,
      lib: {
        entry: path.resolve(__dirname, 'src/background/background.ts'),
        name: 'BackgroundWorker',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
    },
  });

  // 3. Build Content Script (IIFE standalone)
  console.log('📦 Step 3: Building Content Script Assistant...');
  await build({
    configFile: false,
    define: defineConstants,
    build: {
      outDir,
      emptyOutDir: false,
      sourcemap: false,
      lib: {
        entry: path.resolve(__dirname, 'src/content/content.ts'),
        name: 'JobFillContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
    },
  });

  // 4. Copy static assets (manifest.json, privacy.html, icons, content.css, optional test-pages)
  console.log('📋 Step 4: Copying assets, privacy policy, and manifest...');

  // Copy manifest.json (strip dev-only localhost & test-pages/* entries in Store production builds)
  const manifestPath = path.resolve(__dirname, 'manifest.json');
  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  if (isStoreClean) {
    const parsedManifest = JSON.parse(manifestRaw);
    const isLocalDevMatch = (m) =>
      String(m).startsWith('http://127.0.0.1') || String(m).startsWith('http://localhost');

    if (Array.isArray(parsedManifest.content_scripts)) {
      parsedManifest.content_scripts = parsedManifest.content_scripts.map((cs) => ({
        ...cs,
        matches: Array.isArray(cs.matches) ? cs.matches.filter((m) => !isLocalDevMatch(m)) : cs.matches,
      }));
    }
    if (Array.isArray(parsedManifest.web_accessible_resources)) {
      parsedManifest.web_accessible_resources = parsedManifest.web_accessible_resources
        .map((entry) => ({
          ...entry,
          resources: Array.isArray(entry.resources)
            ? entry.resources.filter((res) => {
                const s = String(res);
                return !s.startsWith('test-pages') && s !== 'dashboard.html' && s !== 'popup.html';
              })
            : [],
          matches: Array.isArray(entry.matches)
            ? entry.matches.filter((m) => !isLocalDevMatch(m))
            : entry.matches,
        }))
        .filter((entry) => entry.resources.length > 0);
    }
    fs.writeFileSync(path.resolve(outDir, 'manifest.json'), JSON.stringify(parsedManifest, null, 2) + '\n', 'utf-8');
  } else {
    fs.writeFileSync(path.resolve(outDir, 'manifest.json'), manifestRaw, 'utf-8');
  }

  // Copy privacy.html (included in both dev and clean Edge Store builds)
  const privacySrc = path.resolve(__dirname, 'privacy.html');
  if (fs.existsSync(privacySrc)) {
    fs.copyFileSync(privacySrc, path.resolve(outDir, 'privacy.html'));
  }

  // Copy content.css
  fs.copyFileSync(
    path.resolve(__dirname, 'src/content/content.css'),
    path.resolve(outDir, 'content.css')
  );

  // Copy icons
  const iconsDist = path.resolve(outDir, 'icons');
  fs.mkdirSync(iconsDist, { recursive: true });
  const iconsSrc = path.resolve(__dirname, 'icons');
  if (fs.existsSync(iconsSrc)) {
    for (const file of fs.readdirSync(iconsSrc)) {
      fs.copyFileSync(path.resolve(iconsSrc, file), path.resolve(iconsDist, file));
    }
  }

  // Copy test-pages ONLY for non-store local dev/test builds
  if (!isStoreClean) {
    const testDist = path.resolve(outDir, 'test-pages');
    fs.mkdirSync(testDist, { recursive: true });
    const testSrc = path.resolve(__dirname, 'test-pages');
    if (fs.existsSync(testSrc)) {
      for (const file of fs.readdirSync(testSrc)) {
        fs.copyFileSync(path.resolve(testSrc, file), path.resolve(testDist, file));
      }
    }
  }

  console.log(`✨ Build Complete! Production extension ready in: ${outDir}`);
}

buildExtension().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
