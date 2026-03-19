const POSITIVE_CATEGORIES = [
  { label: 'Easy to use', patterns: [/easy to use/i, /simple/i, /intuitive/i, /straightforward/i, /user friendly/i] },
  { label: 'Saves time', patterns: [/save(s|d)? time/i, /fast/i, /quick/i, /efficient/i] },
  { label: 'Reliable', patterns: [/reliable/i, /works great/i, /works well/i, /stable/i, /consistent/i] },
  { label: 'Useful features', patterns: [/feature/i, /powerful/i, /flexible/i, /custom/i, /option/i] },
  { label: 'Good support', patterns: [/support/i, /responsive/i, /helpful/i, /developer/i, /updates/i] }
];

const NEGATIVE_CATEGORIES = [
  { label: 'Bugs and crashes', patterns: [/bug/i, /broken/i, /crash/i, /issue/i, /error/i] },
  { label: 'Slow or heavy', patterns: [/slow/i, /lag/i, /heavy/i, /memory/i, /performance/i] },
  { label: 'Confusing UX', patterns: [/confusing/i, /hard to use/i, /difficult/i, /clunky/i, /complicated/i] },
  { label: 'Missing features', patterns: [/missing/i, /lack/i, /wish/i, /need/i, /should have/i] },
  { label: 'Bad support or updates', patterns: [/no response/i, /support/i, /abandoned/i, /outdated/i, /stopped working/i] }
];

const state = {
  reviews: [],
  summary: null,
  pageMeta: null
};

const analyzeButton = document.querySelector('#analyzeButton');
const exportButton = document.querySelector('#exportButton');
const statusBadge = document.querySelector('#statusBadge');
const statusMessage = document.querySelector('#statusMessage');
const metricsPanel = document.querySelector('#metricsPanel');
const summaryPanel = document.querySelector('#summaryPanel');
const quotesPanel = document.querySelector('#quotesPanel');
const reviewCount = document.querySelector('#reviewCount');
const averageRating = document.querySelector('#averageRating');
const positiveCount = document.querySelector('#positiveCount');
const negativeCount = document.querySelector('#negativeCount');
const likesList = document.querySelector('#likesList');
const dislikesList = document.querySelector('#dislikesList');
const positiveQuotes = document.querySelector('#positiveQuotes');
const negativeQuotes = document.querySelector('#negativeQuotes');

analyzeButton.addEventListener('click', analyzeCurrentPage);
exportButton.addEventListener('click', exportReviews);

async function analyzeCurrentPage() {
  setStatus('loading', 'Collecting visible reviews from the current Chrome Web Store page...');
  toggleBusy(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isSupportedPage(tab.url)) {
      throw new Error('Open a Chrome Web Store extension page first.');
    }

    const response = await requestReviewsFromTab(tab.id);
    if (!response?.reviews?.length) {
      throw new Error('No visible reviews were found. Scroll until reviews are visible and click Analyze Current Page again.');
    }

    state.reviews = response.reviews;
    state.summary = summarizeReviews(response.reviews);
    state.pageMeta = {
      title: response.pageTitle,
      url: response.url,
      collectedAt: response.collectedAt
    };

    renderSummary(state.summary);
    exportButton.disabled = false;
    setStatus('success', `Analyzed ${response.reviews.length} visible reviews from this page.`);
  } catch (error) {
    exportButton.disabled = true;
    metricsPanel.hidden = true;
    summaryPanel.hidden = true;
    quotesPanel.hidden = true;
    setStatus('error', `${error.message || 'Failed to analyze the current page.'} If this is your first run, reload the Chrome Web Store tab once and try again.`);
  } finally {
    toggleBusy(false);
  }
}

async function requestReviewsFromTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_REVIEWS' });
    if (response?.reviews?.length) {
      return response;
    }
  } catch {
  }

  const executionResults = await chrome.scripting.executeScript({
    target: { tabId },
    func: runScrapeOnPage
  });

  return executionResults?.[0]?.result || { reviews: [] };
}

function summarizeReviews(reviews) {
  const totals = reviews.reduce(
    (accumulator, review) => {
      accumulator.ratingSum += review.rating || 0;
      if ((review.rating || 0) >= 4) {
        accumulator.positive += 1;
      } else if ((review.rating || 0) <= 2) {
        accumulator.negative += 1;
      }
      return accumulator;
    },
    { ratingSum: 0, positive: 0, negative: 0 }
  );

  const positiveThemes = scoreThemes(reviews.filter((review) => (review.rating || 0) >= 4), POSITIVE_CATEGORIES);
  const negativeThemes = scoreThemes(reviews.filter((review) => (review.rating || 0) <= 2), NEGATIVE_CATEGORIES);

  return {
    totalReviews: reviews.length,
    averageRating: reviews.length ? totals.ratingSum / reviews.length : 0,
    positiveCount: totals.positive,
    negativeCount: totals.negative,
    positiveThemes,
    negativeThemes,
    positiveQuotes: selectQuotes(reviews, 'positive'),
    negativeQuotes: selectQuotes(reviews, 'negative')
  };
}

function scoreThemes(reviews, categories) {
  const themeCounts = categories.map((category) => ({ label: category.label, count: 0 }));

  for (const review of reviews) {
    const text = `${review.title || ''} ${review.body || ''}`.toLowerCase();
    for (const [index, category] of categories.entries()) {
      if (category.patterns.some((pattern) => pattern.test(text))) {
        themeCounts[index].count += 1;
      }
    }
  }

  return themeCounts
    .filter((theme) => theme.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

function selectQuotes(reviews, sentiment) {
  const filtered = reviews.filter((review) => {
    if (sentiment === 'positive') {
      return (review.rating || 0) >= 4;
    }

    return (review.rating || 0) <= 2;
  });

  return filtered
    .sort((left, right) => (right.body || '').length - (left.body || '').length)
    .slice(0, 3)
    .map((review) => ({
      text: review.body || review.title || 'No text captured.',
      author: review.author || 'Anonymous',
      rating: review.rating || 0
    }));
}

function renderSummary(summary) {
  metricsPanel.hidden = false;
  summaryPanel.hidden = false;
  quotesPanel.hidden = false;

  reviewCount.textContent = String(summary.totalReviews);
  averageRating.textContent = summary.averageRating.toFixed(1);
  positiveCount.textContent = String(summary.positiveCount);
  negativeCount.textContent = String(summary.negativeCount);

  renderThemeList(likesList, summary.positiveThemes, 'No dominant positive themes detected yet.');
  renderThemeList(dislikesList, summary.negativeThemes, 'No dominant negative themes detected yet.');
  renderQuotes(positiveQuotes, summary.positiveQuotes, 'No positive quotes found.');
  renderQuotes(negativeQuotes, summary.negativeQuotes, 'No negative quotes found.');
}

function renderThemeList(container, themes, emptyMessage) {
  container.innerHTML = '';

  if (!themes.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'emptyState';
    emptyItem.textContent = emptyMessage;
    container.appendChild(emptyItem);
    return;
  }

  for (const theme of themes) {
    const item = document.createElement('li');
    item.innerHTML = `
      <div class="themeRow">
        <span class="themeName">${escapeHtml(theme.label)}</span>
        <span class="themeCount">${theme.count} mentions</span>
      </div>
    `;
    container.appendChild(item);
  }
}

function renderQuotes(container, quotes, emptyMessage) {
  container.innerHTML = '';

  if (!quotes.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'emptyState';
    emptyItem.textContent = emptyMessage;
    container.appendChild(emptyItem);
    return;
  }

  for (const quote of quotes) {
    const item = document.createElement('li');
    item.innerHTML = `
      <blockquote>“${escapeHtml(quote.text)}”</blockquote>
      <div class="quoteMeta">${escapeHtml(quote.author)} • ${quote.rating.toFixed(1)}★</div>
    `;
    container.appendChild(item);
  }
}

async function exportReviews() {
  if (!state.reviews.length || !state.summary) {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const payload = {
    page: state.pageMeta,
    summary: state.summary,
    reviews: state.reviews
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({
      url,
      filename: `chrome-comment-scrape-${timestamp}.json`,
      saveAs: true
    });
    setStatus('success', 'Exported review data as JSON.');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function setStatus(stateName, message) {
  statusBadge.className = `statusBadge ${stateName}`;
  statusBadge.textContent = capitalize(stateName);
  statusMessage.textContent = message;
}

function toggleBusy(isBusy) {
  analyzeButton.disabled = isBusy;
}

function isSupportedPage(url) {
  return /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)\//i.test(url || '');
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function runScrapeOnPage() {
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

  const allRoots = collectRoots(document);
  const candidates = collectCandidates(allRoots, reviewCardSelectors);
  const reviews = [];
  const seenKeys = new Set();

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
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    reviews.push({ rating, title, body, author, date });
  }

  return {
    pageTitle: document.title,
    url: window.location.href,
    reviewCount: reviews.length,
    reviews,
    collectedAt: new Date().toISOString()
  };

  function collectRoots(rootDocument) {
    const roots = [rootDocument];
    const stack = [rootDocument.documentElement];

    while (stack.length) {
      const node = stack.pop();
      if (!node) {
        continue;
      }

      if (node.shadowRoot) {
        roots.push(node.shadowRoot);
        stack.push(node.shadowRoot);
      }

      for (const child of node.children || []) {
        stack.push(child);
      }
    }

    return roots;
  }

  function collectCandidates(roots, selectors) {
    const found = [];
    for (const root of roots) {
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
      const match = String(source).match(/([1-5](?:\.\d+)?)\s*(?:out of 5|stars?)/i);
      if (match) {
        return Number(match[1]);
      }
    }

    const wholeText = normalizeWhitespace(node.innerText || node.textContent || '');
    const starMatch = wholeText.match(/([1-5](?:\.\d+)?)\s*(?:out of 5|stars?)/i);
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
    return value.replace(/\s+/g, ' ').trim();
  }

  function looksLikeDate(value) {
    return /\b(today|yesterday|ago|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})\b/i.test(value);
  }

  function looksLikeRating(value) {
    return /(out of 5|stars?)/i.test(value);
  }
}
