# NZ Fixtures

Mobile-friendly single-page site showing upcoming All Blacks rugby, Black Caps
cricket, and Sri Lanka's full cricket schedule, sorted by date with the next
match in each section highlighted, all times shown in NZ time (and Vietnam
time alongside it, where a time is available).

## How it works

A small Express server scrapes three sources on a schedule and serves cached
JSON to the frontend, rather than scraping on every page load:

- **Rugby** — [allblacks.com/team/all-blacks/fixtures](https://www.allblacks.com/team/all-blacks/fixtures).
  Fixture data is embedded as JSON in the server-rendered HTML, so a plain `fetch`
  is enough (`scrapers/allblacks.js`).
- **Cricket (Black Caps)** — [scoring.nzc.nz/fixtures](https://scoring.nzc.nz/fixtures)
  (New Zealand Cricket's own fixtures app). This one sits behind a Vercel
  bot-protection JS challenge that a plain request can't pass, so it's scraped
  with headless Chromium via Playwright (`scrapers/blackcaps.js`), then
  filtered down to BLACKCAPS matches only.

  (`espncricinfo.com`, the originally requested source, blocks server-side
  scraping entirely via Akamai bot protection — confirmed with both plain
  requests and headless Chromium — so this NZC source is used instead.)
- **Cricket (Sri Lanka, full schedule)** — Wikipedia's "International cricket
  in `<year>`" pages (current year + next year), parsed with `cheerio`
  (`scrapers/srilanka.js`). Every other source tried for this (ESPN Cricinfo,
  Sri Lanka Cricket's own site, Cricbuzz) was either bot-protected or had no
  usable fixture data — see git history for what was tried. Trade-offs from
  using Wikipedia:
  - Only bilateral tour series ("X in Y" headings) are parsed; multi-team
    tournaments (ICC events, the Asian Games, etc.) use a different table
    shape and aren't included.
  - These summary tables don't publish kick-off times, only dates — the
    frontend shows "Exact kick-off time not published" for this section
    instead of a NZ/Vietnam time.
  - Coverage depends on Wikipedia volunteers keeping the page current, so a
    recently-confirmed tour can be missing for a while.

  This section is independent of the match-day email reminders below (which
  stay scoped to the two NZ teams only).

All three scrapers run independently. If one source fails or changes layout,
the site keeps serving the other sections fine and falls back to the last
successfully-scraped data for the failing one (see `lib/scrapeAll.js`).

Results are cached to `data/cache.json` and re-scraped once daily at 4am NZ
time via `node-cron` (`server.js`), plus once on server boot if no cache exists
yet.

## Match-day email reminders

Every 15 minutes (`server.js`), a job checks the cached fixtures for any match
kicking off in the next 45-60 minutes and, if a reminder hasn't already gone
out for it, emails one via [Resend](https://resend.com) (`lib/resend.js`).
Sent reminders are recorded in `data/sentReminders.json` (`lib/sentReminders.js`)
so restarts and repeat checks don't send duplicates; entries older than 7 days
are pruned automatically.

Requires these environment variables (unset = reminders silently disabled,
everything else keeps working):

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | yes | Resend API key |
| `REMINDER_TO_EMAIL` | yes | Recipient address |
| `RESEND_FROM_EMAIL` | no | From address (defaults to Resend's sandbox `onboarding@resend.com`, which can only send to the email your Resend account is registered with — verify a domain in Resend to send to anyone else) |
| `APP_URL` | no | Link included in the email (defaults to the Railway URL below) |

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
