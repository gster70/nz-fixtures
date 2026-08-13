const { scrapeAllBlacksFixtures } = require('../scrapers/allblacks');
const { scrapeBlackCapsFixtures } = require('../scrapers/blackcaps');
const { readCache, writeCache } = require('./cache');

async function scrapeSource(name, scrapeFn, previous) {
  try {
    const fixtures = await scrapeFn();
    console.log(`[scrape] ${name}: ${fixtures.length} fixtures`);
    return { fixtures, updatedAt: new Date().toISOString(), error: null };
  } catch (err) {
    console.error(`[scrape] ${name} failed:`, err.message);
    // Keep serving the last good data rather than blanking out the section.
    return {
      fixtures: previous?.fixtures || [],
      updatedAt: previous?.updatedAt || null,
      error: err.message,
    };
  }
}

async function scrapeAll() {
  const previous = readCache() || {};
  const [rugby, cricket] = await Promise.all([
    scrapeSource('rugby', scrapeAllBlacksFixtures, previous.rugby),
    scrapeSource('cricket', scrapeBlackCapsFixtures, previous.cricket),
  ]);
  const next = { rugby, cricket };
  writeCache(next);
  return next;
}

module.exports = { scrapeAll };
