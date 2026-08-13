# NZ Fixtures

Mobile-friendly single-page site showing upcoming All Blacks rugby and Black Caps
cricket fixtures, sorted by date with the next match highlighted, all times shown
in NZ time (and Vietnam time alongside it).

## How it works

A small Express server scrapes two sources on a schedule and serves cached JSON
to the frontend, rather than scraping on every page load:

- **Rugby** — [allblacks.com/team/all-blacks/fixtures](https://www.allblacks.com/team/all-blacks/fixtures).
  Fixture data is embedded as JSON in the server-rendered HTML, so a plain `fetch`
  is enough (`scrapers/allblacks.js`).
- **Cricket** — [scoring.nzc.nz/fixtures](https://scoring.nzc.nz/fixtures) (New
  Zealand Cricket's own fixtures app). This one sits behind a Vercel bot-protection
  JS challenge that a plain request can't pass, so it's scraped with headless
  Chromium via Playwright (`scrapers/blackcaps.js`), then filtered down to
  BLACKCAPS matches only.

  (`espncricinfo.com`, the originally requested source, blocks server-side
  scraping entirely via Akamai bot protection — confirmed with both plain
  requests and headless Chromium — so this NZC source is used instead.)

Both scrapers run independently. If one source fails or changes layout, the
site keeps serving the other section fine and falls back to the last
successfully-scraped data for the failing one (see `lib/scrapeAll.js`).

Results are cached to `data/cache.json` and re-scraped once daily at 4am NZ
time via `node-cron` (`server.js`), plus once on server boot if no cache exists
yet.

## Local development

```bash
npm install
npm run scrape   # one-off scrape to populate data/cache.json
npm start        # serves http://localhost:3000
```

## Deployment

Deployed on Railway using the included `Dockerfile` (based on the official
Playwright image, since the cricket scraper needs a real Chromium browser).
`railway.json` configures the build/start commands.
