# NZ Fixtures

Mobile-friendly single-page site showing upcoming All Blacks rugby, Black Caps
cricket, and Sri Lanka's full cricket schedule, sorted by date with the next
match in each section highlighted, all times shown in NZ time (and Vietnam
time alongside it).

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
- **Cricket (Sri Lanka, full schedule)** — the JSON feed behind icc-cricket.com's
  own fixtures page (`assets-icc.sportz.io/cricket/v1/schedule`, discovered by
  watching that page's network requests; see `scrapers/srilanka.js`), filtered
  to matches involving Sri Lanka, fetched for a rolling year ahead. It's a
  plain unauthenticated JSON API — no bot protection, real kick-off times.

  This wasn't the first thing tried. In order: ESPN Cricinfo and Cricbuzz are
  both bot-protected the same way as the sources above; Sri Lanka Cricket's
  own site has no usable content on its fixtures pages; icc-cricket.com's
  *visible* fixtures page only ever shows a rolling 30-day window; Wikipedia's
  "International cricket in `<year>`" pages have full-year coverage but lag
  behind reality for recently-confirmed tours (a Sri Lanka-Pakistan series
  already scheduled for November wasn't on the page yet, leaving the section
  showing only a single upcoming match for a while). The Sportz.io feed
  underneath ICC's own page turned out to have exactly what
  every other source was missing: full-year range, real times, and no lag.

  This section is independent of the match-day email reminders below (which
  stay scoped to the two NZ teams only).

All three scrapers run independently. If one source fails or changes layout,
the site keeps serving the other sections fine and falls back to the last
successfully-scraped data for the failing one (see `lib/scrapeAll.js`).

Results are cached to `data/cache.json` and re-scraped once daily at 4am NZ
time via `node-cron` (`server.js`), plus once on server boot if no cache exists
yet.

## Match-day reminders (email + WhatsApp)

Every 15 minutes (`server.js`), a job checks the cached fixtures for any match
kicking off in the next 45-60 minutes and, for each channel that's configured
and hasn't already notified for that fixture, sends a reminder:

- **Email** via [Resend](https://resend.com) (`lib/resend.js`)
- **WhatsApp** via [Twilio's WhatsApp API](https://www.twilio.com/docs/whatsapp) (`lib/twilio.js`)

The two channels are independent — each is skipped if its env vars aren't
set, and if one fails to send it doesn't block or duplicate the other. Sent
state is recorded per fixture *and* per channel in `data/sentReminders.json`
(`lib/sentReminders.js`), so a failure only causes a retry of the channel
that actually failed, restarts don't cause re-sends, and entries older than
7 days are pruned automatically.

Requires these environment variables (each channel silently disabled until
its own vars are set — everything else keeps working):

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | for email | Resend API key |
| `REMINDER_TO_EMAIL` | for email | Recipient email address |
| `RESEND_FROM_EMAIL` | no | From address (defaults to Resend's sandbox `onboarding@resend.com`, which can only send to the email your Resend account is registered with — verify a domain in Resend to send to anyone else) |
| `TWILIO_ACCOUNT_SID` | for WhatsApp | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | for WhatsApp | Twilio Auth Token |
| `TWILIO_WHATSAPP_FROM` | for WhatsApp | Twilio's WhatsApp-enabled sender number, e.g. `whatsapp:+14155238886` for the Twilio Sandbox (the `whatsapp:` prefix is added automatically if omitted) |
| `REMINDER_WHATSAPP_TO` | for WhatsApp | Recipient's WhatsApp number, e.g. `+64211234567` |
| `TWILIO_WHATSAPP_TEMPLATE_SID` | no | Twilio Content SID (`HX...`) of an approved WhatsApp template — see below. Unset = free-form messages. |
| `APP_URL` | no | Link included in both reminder messages (defaults to the Railway URL below) |

Two things worth knowing about the WhatsApp side specifically:

- **Sandbox mode**: while using Twilio's free WhatsApp Sandbox (rather than
  an approved WhatsApp Business sender), the recipient has to send the
  sandbox's join code to the sandbox number once before it can message them.
- **The 24-hour session window**: WhatsApp Business policy only allows
  free-form messages within 24 hours of the recipient last messaging the
  business number. Outside that window, only a pre-approved message
  *template* can be sent — which is what `TWILIO_WHATSAPP_TEMPLATE_SID`
  switches to (`lib/twilio.js` sends via Twilio's Content API with
  `ContentSid` + `ContentVariables` instead of a free-form `Body` once it's
  set). Until then, the recipient needs to message the sandbox/business
  number occasionally to keep the window open, or Twilio rejects the send
  (visible in the Railway logs as `[reminder] whatsapp failed`).

  To set one up: in Meta's WhatsApp Manager (the same place as this app's
  sibling project's `lotus_*` templates), create a **Utility** category
  template with this exact body and 5 variables, so it lines up with
  `buildWhatsAppTemplateVariables` in `lib/reminders.js`:

  > `{{1}} play {{2}} in about an hour.`
  > `Competition: {{3}}`
  > `Kickoff (NZ time): {{4}}`
  > `{{5}}`

  Sample values for the approval form: `All Blacks` / `Australia` /
  `Rugby Championship` / `Sat, 10 Oct 2026, 7:10 pm NZDT` /
  `https://nz-fixtures-production.up.railway.app`. Once Meta approves it,
  find its Content SID in the Twilio Console (Content Editor — Twilio
  auto-imports templates approved through a linked WhatsApp Business
  Account) and set that as `TWILIO_WHATSAPP_TEMPLATE_SID`.

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
