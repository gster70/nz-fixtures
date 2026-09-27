const path = require('path');
const express = require('express');
const cron = require('node-cron');
const { readCache } = require('./lib/cache');
const { scrapeAll } = require('./lib/scrapeAll');
const { checkAndSendReminders } = require('./lib/reminders');

const PORT = process.env.PORT || 3000;
const UPCOMING_GRACE_HOURS = 6; // keep showing a match for a while after it starts

function upcomingOnly(section) {
  if (!section) return { fixtures: [], updatedAt: null, error: 'no data yet' };
  const cutoff = Date.now() - UPCOMING_GRACE_HOURS * 60 * 60 * 1000;
  const fixtures = section.fixtures
    .filter((f) => new Date(f.kickoffUtc).getTime() >= cutoff)
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));
  return { fixtures, updatedAt: section.updatedAt, error: section.error };
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/fixtures', (req, res) => {
  const cache = readCache() || {};
  res.json({
    rugby: upcomingOnly(cache.rugby),
    cricket: upcomingOnly(cache.cricket),
    srilanka: upcomingOnly(cache.srilanka),
  });
});

async function start() {
  if (!readCache()) {
    console.log('No cached data found, running initial scrape before serving traffic...');
    await scrapeAll().catch((err) => console.error('Initial scrape failed:', err));
  }

  app.listen(PORT, () => {
    console.log(`NZ Fixtures listening on port ${PORT}`);
  });

  // Daily refresh at 4am NZ time (handles NZST/NZDT automatically).
  cron.schedule('0 4 * * *', () => {
    console.log('Running scheduled daily scrape...');
    scrapeAll().catch((err) => console.error('Scheduled scrape failed:', err));
  }, { timezone: 'Pacific/Auckland' });

  if (process.env.REMINDER_TO_EMAIL && process.env.RESEND_API_KEY) {
    console.log('Match-day email reminders are configured and active.');
  } else {
    console.log('Match-day email reminders are not configured (REMINDER_TO_EMAIL / RESEND_API_KEY missing) — skipping.');
  }

  // Every 15 minutes, check for fixtures kicking off in 45-60 minutes.
  cron.schedule('*/15 * * * *', () => {
    checkAndSendReminders().catch((err) => console.error('Reminder check failed:', err));
  });
}

start();
