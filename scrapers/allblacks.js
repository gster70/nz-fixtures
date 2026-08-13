const { extractFixtureObjects } = require('../lib/rscExtract');

const URL = 'https://www.allblacks.com/team/all-blacks/fixtures';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function scrapeAllBlacksFixtures() {
  const resp = await fetch(URL, { headers: { 'User-Agent': UA } });
  if (!resp.ok) {
    throw new Error(`allblacks.com responded ${resp.status}`);
  }
  const html = await resp.text();
  const matches = extractFixtureObjects(html, 'optaMatchId');

  const seen = new Set();
  const fixtures = [];
  for (const m of matches) {
    if (!m.dateTime || !m.homeTeamName || !m.awayTeamName) continue;
    if (seen.has(m.optaMatchId)) continue;
    seen.add(m.optaMatchId);
    fixtures.push({
      id: `ab-${m.optaMatchId}`,
      sport: 'rugby',
      competition: m.optaCompetitionName || 'All Blacks',
      homeTeam: m.homeTeamName,
      awayTeam: m.awayTeamName,
      venue: m.venue || '',
      kickoffUtc: new Date(m.dateTime).toISOString(),
    });
  }

  if (fixtures.length === 0) {
    throw new Error('allblacks.com scrape returned zero fixtures — page layout may have changed');
  }

  return fixtures;
}

module.exports = { scrapeAllBlacksFixtures };
