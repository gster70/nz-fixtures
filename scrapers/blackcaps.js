const { chromium } = require('playwright');
const { extractFixtureObjects } = require('../lib/rscExtract');

const URL = 'https://scoring.nzc.nz/fixtures';
const TEAM_NAME = 'BLACKCAPS';
const MAX_ATTEMPTS = 3;

function parseFixtures(html) {
  const matches = extractFixtureObjects(html, 'gid');
  const seen = new Set();
  const fixtures = [];
  for (const m of matches) {
    if (!m.start_datetime_utc || !m.team1_name || !m.team2_name) continue;
    if (m.team1_name !== TEAM_NAME && m.team2_name !== TEAM_NAME) continue;
    if (seen.has(m.gid)) continue;
    seen.add(m.gid);

    const kickoffUtc = new Date(m.start_datetime_utc.replace(' ', 'T') + 'Z').toISOString();

    fixtures.push({
      id: `bc-${m.gid}`,
      sport: 'cricket',
      competition: [m.comp_name, m.comp_season].filter(Boolean).join(' '),
      homeTeam: m.team1_name,
      awayTeam: m.team2_name,
      matchType: m.title || '',
      venue: m.ground_name || '',
      kickoffUtc,
    });
  }
  return fixtures;
}

async function attemptScrape() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    // scoring.nzc.nz runs its matches through a Vercel bot-protection JS
    // challenge that a plain HTTP request can't pass, and the challenge
    // resolves via a full page reload — waiting for networkidle rides that
    // out rather than racing it with a DOM-content check on the wrong page.
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);
    return await page.content();
  } finally {
    await browser.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeBlackCapsFixtures() {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const html = await attemptScrape();
      const fixtures = parseFixtures(html);
      if (fixtures.length > 0) {
        return fixtures;
      }
      lastError = new Error('scoring.nzc.nz scrape returned zero BLACKCAPS fixtures — page layout may have changed');
    } catch (err) {
      lastError = err;
    }
    console.warn(`[blackcaps] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${lastError.message}`);
    if (attempt < MAX_ATTEMPTS) await sleep(5000);
  }
  throw lastError;
}

module.exports = { scrapeBlackCapsFixtures };
