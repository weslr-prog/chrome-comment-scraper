import process from 'node:process';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
if (!args.url) {
  printUsageAndExit('Missing required --url argument.');
}

const outDir = args.outDir || 'output';
const outputReviews = args.reviews || path.join(outDir, 'reviews.json');
const outputSummary = args.summary || path.join(outDir, 'summary.json');
const scrolls = args.scrolls || '12';
const waitMs = args.waitMs || '1400';
const headless = args.headless || 'true';

runCommand('node', [
  'scripts/scrape-reviews.mjs',
  '--url',
  args.url,
  '--out',
  outputReviews,
  '--scrolls',
  String(scrolls),
  '--waitMs',
  String(waitMs),
  '--headless',
  String(headless)
]);

runCommand('node', [
  'scripts/summarize-reviews.mjs',
  '--in',
  outputReviews,
  '--out',
  outputSummary
]);

console.log(`\nDone.\n- Reviews: ${outputReviews}\n- Summary: ${outputSummary}`);

function runCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: false,
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function printUsageAndExit(message) {
  if (message) {
    console.error(message);
  }

  console.log(`\nUsage:\n  node scripts/analyze-reviews.mjs --url <chrome_web_store_url> [--outDir output] [--reviews output/reviews.json] [--summary output/summary.json] [--scrolls 12] [--waitMs 1400] [--headless true]\n`);
  process.exit(1);
}
