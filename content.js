const REVIEW_CARD_SELECTORS = [
  '[data-review-id]',
  '[data-reviewid]',
  'article',
  'div[role="article"]',
  'section'
];

const TEXT_BLOCK_SELECTORS = [
  'p',
  '[data-review-body]',
  '[data-test-id="review-text"]',
  '.review-text',
  '.comment',
  '[role="paragraph"]'
];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'SCRAPE_REVIEWS') {
    return false;
  }

  const reviews = scrapeVisibleReviews();
  sendResponse({
    pageTitle: document.title,
    url: window.location.href,
    reviewCount: reviews.length,
    reviews,
    collectedAt: new Date().toISOString()
  });
  return true;
});

function scrapeVisibleReviews() {
  const candidates = collectCandidates();
  const reviews = [];
  const seenKeys = new Set();

  for (const candidate of candidates) {
    const rating = parseRating(candidate);
    if (!rating) {
      continue;
    }

    const review = extractReview(candidate, rating);
    if (!review.body && !review.title) {
      continue;
    }

    const key = [review.author, review.date, review.title, review.body].join('|').toLowerCase();
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    reviews.push(review);
  }

  return reviews;
}

function collectCandidates() {
  const nodes = REVIEW_CARD_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  return nodes.filter((node) => {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    const rect = node.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0;
    const text = normalizeWhitespace(node.innerText || '');
    return visible && text.length >= 20;
  });
}

function extractReview(node, rating) {
  const rawLines = uniqueLines(node.innerText || '');
  const title = extractTitle(node, rawLines);
  const body = extractBody(node, rawLines, title);
  const author = extractAuthor(node, rawLines);
  const date = extractDate(node, rawLines);

  return {
    rating,
    title,
    body,
    author,
    date
  };
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

function extractBody(node, rawLines, title) {
  const textNodes = TEXT_BLOCK_SELECTORS.flatMap((selector) => Array.from(node.querySelectorAll(selector)));
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
    const match = String(source).match(/([1-5](?:\.\d+)?)\s*(?:out of 5|stars?)/i);
    if (match) {
      return Number(match[1]);
    }
  }

  const textMatch = normalizeWhitespace(node.innerText || '').match(/([1-5](?:\.\d+)?)\s*(?:out of 5|stars?)/i);
  return textMatch ? Number(textMatch[1]) : 0;
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
  return value.replace(/\s+/g, ' ').trim();
}

function looksLikeDate(value) {
  return /\b(today|yesterday|ago|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})\b/i.test(value);
}

function looksLikeRating(value) {
  return /(out of 5|stars?)/i.test(value);
}
