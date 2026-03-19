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

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_REVIEWS' });
    if (!response?.reviews?.length) {
      throw new Error('No visible reviews were found. Scroll until reviews are on screen, then try again.');
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
    setStatus('error', error.message || 'Failed to analyze the current page.');
  } finally {
    toggleBusy(false);
  }
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
