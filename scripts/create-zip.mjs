import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const srcDir = path.resolve(ROOT, 'release', 'edge', 'unpacked-v2.0.1');
const dstZip = path.resolve(ROOT, 'release', 'JobFill-BD-Edge-v2.0.1.zip');

if (!fs.existsSync(srcDir)) {
  console.error(`Source directory not found: ${srcDir}`);
  process.exit(1);
}

if (fs.existsSync(dstZip)) {
  fs.unlinkSync(dstZip);
}

const psScript = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = [System.IO.Path]::GetFullPath('${srcDir.replace(/\\/g, '\\\\')}')
$target = [System.IO.Path]::GetFullPath('${dstZip.replace(/\\/g, '\\\\')}')

if (Test-Path $target) { Remove-Item $target -Force }

$zip = [System.IO.Compression.ZipFile]::Open($target, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -Path $source -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($source.Length + 1).Replace('\\\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $zip.Dispose()
}

$fi = Get-Item $target
Write-Host "Created: $target"
Write-Host "Length: $($fi.Length) bytes"
`;

execFileSync('powershell', ['-NoProfile', '-Command', psScript], { stdio: 'inherit' });
