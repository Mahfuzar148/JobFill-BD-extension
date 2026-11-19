import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function scanPackage() {
  const tmpDir = path.resolve('release/tmp_zip_scan');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  execSync(`tar -xf release/JobFill-BD-Edge-v2.0.1.zip -C "${tmpDir}"`);

  const files = fs.readdirSync(tmpDir, { recursive: true, withFileTypes: true })
    .filter(f => f.isFile())
    .map(f => path.join(f.path || tmpDir, f.name));

  console.log(`Extracted ${files.length} files for scanning.`);

  const suspiciousPatterns = [
    /AIza[0-9A-Za-z-_]{35}/g, // Google API Key
    /(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24}/g, // Stripe
    /ghp_[0-9a-zA-Z]{36}/g, // GitHub Personal Access Token
    /EDGE_CLIENT_ID|EDGE_API_KEY/g,
    /client_secret/i,
    /http:\/\/localhost/i,
    /http:\/\/127\.0\.0\.1/i,
    /webpack-dev-server/i,
    /sourceMappingURL/i
  ];

  let secretsFound = 0;
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg')) continue;
    const content = fs.readFileSync(file, 'utf-8');
    for (const pat of suspiciousPatterns) {
      const match = content.match(pat);
      if (match) {
        console.log(`[ALERT] Found match for ${pat} in ${path.relative(tmpDir, file)}:`, match.slice(0, 3));
        secretsFound++;
      }
    }
  }

  if (secretsFound === 0) {
    console.log('✓ Zero secrets, API keys, dev URLs, or sourceMappingURL references found in release ZIP.');
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

scanPackage().catch(console.error);
