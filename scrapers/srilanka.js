const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const EXCLUDE_PATTERN = /women|under-?19|emerging|\ba team\b|development/i;
const TOUR_PATTERN = /^(.+?)\s+in\s+(.+)$/i;

async function fetchYearPage(year) {
  const url = `https://en.wikipedia.org/wiki/International_cricket_in_${year}`;
  const resp = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error(`Wikipedia responded ${resp.status} for ${year}`);
  return resp.text();
}

function normalizeFormat(text) {
  const cleaned = text.replace(/\s*series\s*$/i, '').trim();
  // e.g. "2025-2027 ICC World Test Championship - Test" -> "Test"
  const dashParts = cleaned.split(/\s*[-–]\s*/);
  return dashParts[dashParts.length - 1].trim();
}

function normalizeTeamName(name) {
  return name.replace(/^the\s+/i, (m) => m[0].toUpperCase() + m.slice(1));
}

function parseDateCell(text, year) {
  const dayMatch = text.match(/\d{1,2}/);
  const monthMatch = text.match(new RegExp(MONTHS.join('|'), 'i'));
  if (!dayMatch || !monthMatch) return null;
  const day = parseInt(dayMatch[0], 10);
  const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === monthMatch[0].toLowerCase());
  if (monthIndex === -1) return null;
  // No kick-off time is published on these summary tables, so this is a
  // date-only placeholder (midnight UTC) — callers must not treat it as a
  // real instant, only as a sortable/day-level value.
  const d = new Date(Date.UTC(year, monthIndex, day));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseSeriesTable($, table, year, seriesTitle) {
  const fixtures = [];
  let currentFormat = '';

  $(table).children('tbody').children('tr').each((_, tr) => {
    const cells = $(tr).children();
    if (cells.length === 0) return;

    const allHeader = cells.toArray().every((c) => c.tagName === 'th');
    if (allHeader) {
      if (cells.length === 1) {
        currentFormat = normalizeFormat($(cells[0]).text().trim());
      }
      return;
    }

    if (cells.length < 3) return;

    const matchLabel = $(cells[0]).text().trim();
    const dateText = $(cells[1]).text().trim();
    const venueText = $(cells[2]).text().trim();

    const date = parseDateCell(dateText, year);
    if (!date) return;

    fixtures.push({ matchLabel, date, venue: venueText, format: currentFormat });
  });

  return fixtures;
}

async function scrapeYear(year, html) {
  const $ = cheerio.load(html);
  const fixtures = [];

  $('h2, h3, h4').each((_, heading) => {
    const $heading = $(heading);
    const title = $heading.clone().children('.mw-editsection').remove().end().text().trim();
    if (!title.includes('Sri Lanka') || EXCLUDE_PATTERN.test(title)) return;

    const match = title.match(TOUR_PATTERN);
    if (!match) return;
    const away = normalizeTeamName(match[1].trim());
    const home = normalizeTeamName(match[2].trim());
    if (home !== 'Sri Lanka' && away !== 'Sri Lanka') return;

    const section = $heading.closest('section');
    if (section.length === 0) return;

    section.children('table.wikitable').each((__, table) => {
      const rows = parseSeriesTable($, table, year, title);
      for (const row of rows) {
        const idPart = row.matchLabel.replace(/\s+/g, '-') || `${title}-${row.date.toISOString()}`;
        fixtures.push({
          id: `sl-${idPart}`,
          sport: 'srilanka',
          competition: title,
          homeTeam: home,
          awayTeam: away,
          matchType: row.format,
          venue: row.venue,
          kickoffUtc: row.date.toISOString(),
          timeUnknown: true,
          dateLabel: row.date.toLocaleDateString('en-NZ', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
          }),
        });
      }
    });
  });

  return fixtures;
}

async function scrapeSriLankaFixtures() {
  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];

  const seen = new Set();
  const all = [];
  for (const year of years) {
    const html = await fetchYearPage(year);
    const fixtures = await scrapeYear(year, html);
    for (const f of fixtures) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      all.push(f);
    }
  }

  if (all.length === 0) {
    throw new Error('Wikipedia scrape returned zero Sri Lanka fixtures — page structure may have changed');
  }

  return all;
}

module.exports = { scrapeSriLankaFixtures };
