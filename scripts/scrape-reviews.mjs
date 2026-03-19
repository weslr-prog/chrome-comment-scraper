import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { summarizeReviews } from './review-summary.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.url) {
  printUsageAndExit('Missing required --url argument.');
}

const outputFile = args.out || path.join('output', `reviews-${Date.now()}.json`);
const maxScrolls = Number(args.scrolls || 10);
const waitMs = Number(args.waitMs || 1200);
const headless = args.headless !== 'false';
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!fs.existsSync(chromePath)) {
  printUsageAndExit(`Chrome executable not found at ${chromePath}. Set CHROME_PATH to your Chrome binary.`);
}

const browser = await chromium.launch({
  headless,
  executablePath: chromePath
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Opening ${args.url}`);
  await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  await openReviewsSection(page);

  for (let index = 0; index < maxScrolls; index += 1) {
    await page.mouse.wheel(0, 2400);
    await page.waitForTimeout(waitMs);
  }

  const result = await page.evaluate(scrapeReviewsInPage);
  const summary = summarizeReviews(result.reviews);

  const payload = {
    page: {
      title: result.pageTitle,
      url: result.url,
      collectedAt: new Date().toISOString(),
      maxScrolls,
      waitMs
    },
    summary,
    reviews: result.reviews
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Collected ${result.reviews.length} reviews.`);
  console.log(`Saved to ${outputFile}`);
} finally {
  await browser.close();
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

  console.log(`\nUsage:\n  node scripts/scrape-reviews.mjs --url <chrome_web_store_url> [--out output/reviews.json] [--scrolls 10] [--waitMs 1200] [--headless false]\n\nEnv:\n  CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n`);
  process.exit(1);
}

async function openReviewsSection(page) {
  const opened = await page.evaluate(() => {
    const labels = ['reviews', 'ratings and reviews'];

    const clickable = Array.from(document.querySelectorAll('button, [role="tab"], a'));
    for (const element of clickable) {
      const text = (element.textContent || '').trim().toLowerCase();
      if (!text) {
        continue;
      }

      if (labels.some((label) => text.includes(label))) {
        element.click();
        return true;
      }
    }

    return false;
  });

  if (opened) {
    await page.waitForTimeout(1500);
  }
}

function scrapeReviewsInPage() {
  const reviewCardSelectors = [
    '[data-review-id]',
    '[data-reviewid]',
    'article',
    'div[role="article"]',
    'section'
  ];

  const textBlockSelectors = [
    'p',
    '[data-review-body]',
    '[data-test-id="review-text"]',
    '.review-text',
    '.comment',
    '[role="paragraph"]'
  ];

  const roots = collectRoots(document);
  const candidates = collectCandidates(roots, reviewCardSelectors);
  const reviews = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const rating = parseRating(candidate);
    const lines = uniqueLines(candidate.innerText || candidate.textContent || '');
    const title = extractTitle(candidate, lines);
    const body = extractBody(candidate, lines, title, textBlockSelectors);
    const author = extractAuthor(candidate, lines);
    const date = extractDate(candidate, lines);

    if (!title && !body) {
      continue;
    }

    const key = [author, date, title, body].join('|').toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    reviews.push({ rating, title, body, author, date });
  }

  return {
    pageTitle: document.title,
    url: window.location.href,
    reviews
  };

  function collectRoots(rootDocument) {
    const foundRoots = [rootDocument];
    const queue = [rootDocument.documentElement];

    while (queue.length) {
      const node = queue.shift();
      if (!node) {
        continue;
      }

      if (node.shadowRoot) {
        foundRoots.push(node.shadowRoot);
        queue.push(node.shadowRoot);
      }

      for (const child of node.children || []) {
        queue.push(child);
      }
    }

    return foundRoots;
  }

  function collectCandidates(allRoots, selectors) {
    const found = [];

    for (const root of allRoots) {
      for (const selector of selectors) {
        for (const node of root.querySelectorAll(selector)) {
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          const rect = node.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          const text = normalizeWhitespace(node.innerText || node.textContent || '');

          if (visible && text.length >= 20) {
            found.push(node);
          }
        }
      }
    }

    return found;
  }

  function extractTitle(node, rawLines) {
    const heading = node.querySelector('h1, h2, h3, h4, [role="heading"]');
    if (heading?.textContent) {
      return normalizeWhitespace(heading.textContent);
    }

    for (const line of rawLines) {
      if (line.length >= 8 && line.length <= 90 && !looksLikeDate(line) && !looksLikeRating(line)) {
        return line;
      }
    }

    return '';
  }

  function extractBody(node, rawLines, title, selectors) {
    const textNodes = selectors.flatMap((selector) => Array.from(node.querySelectorAll(selector)));
    const textBlocks = textNodes
      .map((element) => normalizeWhitespace(element.textContent || ''))
      .filter((text) => text && text !== title);

    if (textBlocks.length) {
      return pickLongest(textBlocks);
    }

    const fallbackLines = rawLines.filter((line) => {
      return line !== title && !looksLikeDate(line) && !looksLikeRating(line) && line.length > 20;
    });

    return pickLongest(fallbackLines);
  }

  function extractAuthor(node, rawLines) {
    const authorNode = node.querySelector('[href*="/profile"], [data-review-author], [itemprop="author"]');
    if (authorNode?.textContent) {
      return normalizeWhitespace(authorNode.textContent);
    }

    for (const line of rawLines) {
      if (line.length >= 2 && line.length <= 40 && /^[a-z0-9 ._'’-]+$/i.test(line) && !looksLikeDate(line) && !looksLikeRating(line)) {
        return line;
      }
    }

    return '';
  }

  function extractDate(node, rawLines) {
    const timeElement = node.querySelector('time');
    if (timeElement?.dateTime) {
      return timeElement.dateTime;
    }

    if (timeElement?.textContent) {
      return normalizeWhitespace(timeElement.textContent);
    }

    const match = rawLines.find((line) => looksLikeDate(line));
    return match || '';
  }

  function parseRating(node) {
    const ratingSources = [
      node.getAttribute('aria-label'),
      node.getAttribute('title'),
      ...Array.from(node.querySelectorAll('[aria-label], [title]')).flatMap((element) => [
        element.getAttribute('aria-label'),
        element.getAttribute('title')
      ])
    ].filter(Boolean);

    for (const source of ratingSources) {
      const match = String(source).match(/([1-5](?:\\.\\d+)?)\\s*(?:out of 5|stars?)/i);
      if (match) {
        return Number(match[1]);
      }
    }

    const wholeText = normalizeWhitespace(node.innerText || node.textContent || '');
    const starMatch = wholeText.match(/([1-5](?:\\.\\d+)?)\\s*(?:out of 5|stars?)/i);
    if (starMatch) {
      return Number(starMatch[1]);
    }

    return 0;
  }

  function uniqueLines(text) {
    const lines = text
      .split('\n')
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);

    return [...new Set(lines)];
  }

  function pickLongest(items) {
    return items.sort((left, right) => right.length - left.length)[0] || '';
  }

  function normalizeWhitespace(value) {
    return value.replace(/\\s+/g, ' ').trim();
  }

  function looksLikeDate(value) {
    return /\\b(today|yesterday|ago|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\\d{4})\\b/i.test(value);
  }

  function looksLikeRating(value) {
    return /(out of 5|stars?)/i.test(value);
  }
}
