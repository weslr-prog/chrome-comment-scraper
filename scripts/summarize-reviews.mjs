import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { summarizeReviews } from './review-summary.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.in) {
  printUsageAndExit('Missing required --in argument.');
}

const inputPath = args.in;
if (!fs.existsSync(inputPath)) {
  printUsageAndExit(`Input file not found: ${inputPath}`);
}

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const reviews = Array.isArray(input) ? input : input.reviews;

if (!Array.isArray(reviews)) {
  printUsageAndExit('Input must be an array of review objects or an object with a "reviews" array.');
}

const summary = summarizeReviews(reviews);

if (args.out) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Summary written to ${args.out}`);
} else {
  console.log(JSON.stringify(summary, null, 2));
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

  console.log(`\nUsage:\n  node scripts/summarize-reviews.mjs --in <reviews.json> [--out output/summary.json]\n`);
  process.exit(1);
}
