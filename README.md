# Chrome Comment Scraper

Chrome Comment Scraper is a lightweight Chrome extension that reads the visible reviews on a Chrome Web Store extension page and turns them into a fast summary of what users like and dislike.

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
2. Enable Developer mode
3. Click Load unpacked
4. Select this project folder

## Use it

1. Open a Chrome Web Store extension page
2. Scroll until review cards are visible on the page
3. Open the extension popup
4. Click Analyze Current Page
5. Review the summary or click Export JSON

## Validate the project

Run the project check script:

```bash
npm run check
```

## Notes

- Review extraction depends on the current Chrome Web Store DOM and may need updates if Google changes the page structure
- The `icons` folder is not populated yet. Chrome can still load the extension unpacked without custom icons
