import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'README.md',
  '.github/copilot-instructions.md',
  'scripts/review-summary.mjs',
  'scripts/scrape-reviews.mjs',
  'scripts/summarize-reviews.mjs',
  'scripts/analyze-reviews.mjs',
  'scripts/ui-server.mjs',
  'ui/index.html',
  'CONTRIBUTING.md'
];

for (const relativePath of requiredFiles) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) {
  throw new Error('manifest.json must use manifest_version 3');
}

console.log('Project check passed.');
