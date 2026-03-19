export const POSITIVE_CATEGORIES = [
  { label: 'Easy to use', patterns: [/easy to use/i, /simple/i, /intuitive/i, /straightforward/i, /user friendly/i] },
  { label: 'Saves time', patterns: [/save(s|d)? time/i, /fast/i, /quick/i, /efficient/i] },
  { label: 'Reliable', patterns: [/reliable/i, /works great/i, /works well/i, /stable/i, /consistent/i] },
  { label: 'Useful features', patterns: [/feature/i, /powerful/i, /flexible/i, /custom/i, /option/i] },
  { label: 'Good support', patterns: [/support/i, /responsive/i, /helpful/i, /developer/i, /updates/i] }
];

export const NEGATIVE_CATEGORIES = [
  { label: 'Bugs and crashes', patterns: [/bug/i, /broken/i, /crash/i, /issue/i, /error/i] },
  { label: 'Slow or heavy', patterns: [/slow/i, /lag/i, /heavy/i, /memory/i, /performance/i] },
  { label: 'Confusing UX', patterns: [/confusing/i, /hard to use/i, /difficult/i, /clunky/i, /complicated/i] },
  { label: 'Missing features', patterns: [/missing/i, /lack/i, /wish/i, /need/i, /should have/i] },
  { label: 'Bad support or updates', patterns: [/no response/i, /support/i, /abandoned/i, /outdated/i, /stopped working/i] }
];

export function summarizeReviews(reviews) {
  const totals = reviews.reduce(
    (accumulator, review) => {
      const rating = Number(review.rating || 0);
      accumulator.ratingSum += rating;
      if (rating >= 4) {
        accumulator.positive += 1;
      } else if (rating <= 2) {
        accumulator.negative += 1;
      }
      return accumulator;
    },
    { ratingSum: 0, positive: 0, negative: 0 }
  );

  const positiveThemes = scoreThemes(reviews.filter((review) => Number(review.rating || 0) >= 4), POSITIVE_CATEGORIES);
  const negativeThemes = scoreThemes(reviews.filter((review) => Number(review.rating || 0) <= 2), NEGATIVE_CATEGORIES);

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
    const rating = Number(review.rating || 0);
    if (sentiment === 'positive') {
      return rating >= 4;
    }

    return rating <= 2;
  });

  return filtered
    .sort((left, right) => (right.body || '').length - (left.body || '').length)
    .slice(0, 3)
    .map((review) => ({
      text: review.body || review.title || 'No text captured.',
      author: review.author || 'Anonymous',
      rating: Number(review.rating || 0)
    }));
}
