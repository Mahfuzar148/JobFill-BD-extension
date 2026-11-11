import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, 'package-stores.mjs');

const res = spawnSync(process.execPath, [scriptPath, '--target=edge'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});
process.exit(res.status ?? 1);
