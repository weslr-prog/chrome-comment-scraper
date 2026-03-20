# Chrome Comment Scraper

Chrome Comment Scraper is a lightweight Chrome extension that reads the visible reviews on a Chrome Web Store extension page and turns them into a fast summary of what users like and dislike.

## Repository

- GitHub: https://github.com/weslr-prog/chrome-comment-scraper
- Branch: `main`

## What it does

- Scrapes the reviews currently visible in the page DOM
- Extracts rating, title, body, author, and date when those fields are available
- Groups recurring positive and negative themes with simple keyword matching
- Shows quick metrics in the popup
- Exports collected reviews and summary data as JSON

## Why visible reviews only

Chrome Web Store pages are dynamic and subject to layout changes. This tool intentionally reads the reviews that are already loaded in the current page so it stays lightweight and easy to run locally.

## Load the extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder

## Quick workflow

1. Navigate to an extension detail page on Chrome Web Store
2. Scroll until reviews are visible
3. Open the extension popup and click **Analyze Current Page**
4. Read the like/dislike themes and representative quotes
5. Click **Export JSON** to save full collected data

## Troubleshooting

If the scraper is not returning reviews:

1. Go to `chrome://extensions`
2. Click **Reload** on Chrome Comment Scraper
3. Refresh the Chrome Web Store tab you want to analyze
4. Scroll down until review cards are visible on screen
5. Open the popup and click **Analyze Current Page** again

Additional checks:

- Confirm you are on a Chrome Web Store extension detail page (not another site)
- Re-open the popup after scrolling, so `activeTab` permission is fresh
- If a page has no loaded review cards yet, keep scrolling and retry

If you see this specific error:

- `The extensions gallery cannot be scripted`

That is a Chrome security restriction. Chrome does not allow extensions to inject or run scripts on Chrome Web Store pages, so direct scraping from an extension popup is blocked by design.

Recommended alternatives:

- Use a separate local script (Node/Playwright) outside the extension context
- Use manual copy workflows and run the summarizer on collected text/data

## Local scraper workflow (recommended)

This repo now includes a local script path that runs outside extension context.

1. Install dependencies:

```bash
npm install
```

2. Scrape reviews from a Chrome Web Store extension URL:

```bash
npm run scrape -- --url "https://chromewebstore.google.com/detail/<extension-id>" --out output/reviews.json --scrolls 12 --waitMs 1400
```

3. Generate a standalone summary JSON:

```bash
npm run summarize -- --in output/reviews.json --out output/summary.json
```

### Simplest execution

Use one command to scrape and summarize in one run:

```bash
npm run analyze -- --url "https://chromewebstore.google.com/detail/<extension-id>"
```

For your provided test URL, use:

```bash
npm run analyze:ultimate-car
```

Notes:

- On macOS, the script uses Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- If your Chrome binary is elsewhere, set `CHROME_PATH` before running:

```bash
CHROME_PATH="/path/to/Google Chrome" npm run scrape -- --url "https://chromewebstore.google.com/detail/<extension-id>"
```

## Use it

1. Open a Chrome Web Store extension page
2. Scroll until review cards are visible on the page
3. Open the extension popup
4. Click Analyze Current Page
5. Review the summary or click Export JSON

## Data shape

Each scraped review includes:

- `rating`
- `title`
- `body`
- `author`
- `date`

Exported JSON contains:

- page metadata (`title`, `url`, `collectedAt`)
- computed summary (counts, average rating, top themes, quotes)
- raw scraped reviews

## Validate the project

Run the project check script:

```bash
npm run check
```

## Notes

- Review extraction depends on the current Chrome Web Store DOM and may need updates if Google changes the page structure
- The `icons` folder is not populated yet. Chrome can still load the extension unpacked without custom icons
- This project intentionally has no framework build chain to keep it fast and lightweight
