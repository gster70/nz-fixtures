const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ICC's own site (icc-cricket.com) loads its fixtures widget from this feed
// client-side. It's the actual source of truth behind their fixtures page —
// clean JSON, real kick-off times, and it covers a full year ahead, unlike
// Wikipedia (long-range but laggy) or ICC's own page (always current but
// only ever shows a rolling 30-day window).
const FEED_URL = 'https://assets-icc.sportz.io/cricket/v1/schedule';
const CLIENT_ID = 'tPZJbRgIub3Vua93/DWtyQ==';
const DAYS_AHEAD = 365;
const TEAM_NAME = 'Sri Lanka';

function formatDate(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function normalizeMatchType(type) {
  if (type === 'T20') return 'T20I';
  return type;
}

function parseKickoff(match) {
  const [month, day, year] = match.match_date_gmt.split('/').map(Number);
  const [hour, minute] = match.match_time_gmt.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchPage(fromDate, toDate, pageNumber, pageSize) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    feed_format: 'json',
    lang: 'en',
    is_deleted: 'false',
    pagination: 'true',
    page_number: String(pageNumber),
    page_size: String(pageSize),
    from_date: fromDate,
    to_date: toDate,
    is_upcoming: 'true',
    is_live: 'true',
    is_recent: 'false',
    league_ids: '1,9',
    timezone: '0000',
  });
  const resp = await fetch(`${FEED_URL}?${params}`, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error(`ICC schedule feed responded ${resp.status}`);
  return resp.json();
}

async function scrapeSriLankaFixtures() {
  const now = new Date();
  const fromDate = formatDate(now);
  const toDate = formatDate(new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000));

  const first = await fetchPage(fromDate, toDate, 1, 250);
  let matches = first.data?.matches || [];
  const total = first.meta?.count ?? matches.length;

  // Defensive: page through if the feed ever caps page_size below the total.
  let pageNumber = 2;
  while (matches.length < total) {
    const next = await fetchPage(fromDate, toDate, pageNumber, 250);
    const batch = next.data?.matches || [];
    if (batch.length === 0) break;
    matches = matches.concat(batch);
    pageNumber += 1;
  }

  const seen = new Set();
  const fixtures = [];
  for (const m of matches) {
    if (m.teama !== TEAM_NAME && m.teamb !== TEAM_NAME) continue;
    if (seen.has(m.match_id)) continue;
    const kickoff = parseKickoff(m);
    if (!kickoff) continue;
    seen.add(m.match_id);

    fixtures.push({
      id: `sl-${m.match_id}`,
      sport: 'srilanka',
      competition: m.series_name || '',
      homeTeam: m.teama,
      awayTeam: m.teamb,
      matchType: normalizeMatchType(m.match_type),
      venue: m.venue || '',
      kickoffUtc: kickoff.toISOString(),
    });
  }

  if (fixtures.length === 0) {
    throw new Error('ICC schedule feed returned zero Sri Lanka fixtures — feed shape may have changed');
  }

  return fixtures;
}

module.exports = { scrapeSriLankaFixtures };
