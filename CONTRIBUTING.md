# Contributing

Thanks for contributing to Chrome Comment Scraper.

## Development workflow

1. Create a branch from `main`
2. Make focused changes
3. Run checks:

```bash
npm run check
```

4. Open a pull request with:
   - What changed
   - Why it changed
   - How it was tested

## Project principles

- Keep the extension lightweight (no heavy framework/tooling)
- Prefer plain JavaScript and minimal dependencies
- Keep scraping logic resilient to DOM layout changes
- Preserve a clean UX in the popup

## Manual test checklist

- Extension loads unpacked in Chrome
- Popup opens and `Analyze Current Page` runs without runtime errors
- At least one Chrome Web Store page returns visible review results
- JSON export downloads successfully

## Notes

- Chrome Web Store markup can change over time; selector updates may be required.
- Avoid storing user data or adding network calls without clear need.
