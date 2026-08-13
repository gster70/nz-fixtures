const { readCache } = require('./cache');
const { load: loadSent, markSent } = require('./sentReminders');
const { sendEmail } = require('./resend');

const TEAM_NAMES = { rugby: 'All Blacks', cricket: 'BLACKCAPS' };
const SPORT_LABEL = { rugby: 'All Blacks', cricket: 'Black Caps' };
const NZ_TZ = 'Pacific/Auckland';

// A match becomes "due" once it's 45-60 minutes out. Paired with the
// 15-minute cron cadence, each fixture should land in this window on
// exactly one check under normal conditions.
const WINDOW_MIN_MS = 45 * 60 * 1000;
const WINDOW_MAX_MS = 60 * 60 * 1000;

const nzDateTimeFmt = new Intl.DateTimeFormat('en-NZ', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: NZ_TZ,
  timeZoneName: 'short',
});

function getOpponent(fixture) {
  const team = TEAM_NAMES[fixture.sport];
  return fixture.homeTeam === team ? fixture.awayTeam : fixture.homeTeam;
}

function findDueFixtures() {
  const cache = readCache() || {};
  const sent = loadSent();
  const now = Date.now();
  const all = [
    ...(cache.rugby?.fixtures || []),
    ...(cache.cricket?.fixtures || []),
  ];
  return all.filter((f) => {
    if (sent[f.id]) return false;
    const diff = new Date(f.kickoffUtc).getTime() - now;
    return diff >= WINDOW_MIN_MS && diff < WINDOW_MAX_MS;
  });
}

function buildEmail(fixture) {
  const opponent = getOpponent(fixture);
  const label = SPORT_LABEL[fixture.sport];
  const kickoffNZ = nzDateTimeFmt.format(new Date(fixture.kickoffUtc));
  const appUrl = process.env.APP_URL || 'https://nz-fixtures-production.up.railway.app';

  const subject = `${label} v ${opponent} kicks off in about an hour`;
  const html = `
    <p>${label} play <strong>${escapeHtml(opponent)}</strong> in about an hour.</p>
    <p><strong>Competition:</strong> ${escapeHtml(fixture.competition)}</p>
    <p><strong>Kickoff:</strong> ${kickoffNZ}</p>
    <p><a href="${appUrl}">${appUrl}</a></p>
  `.trim();

  return { subject, html };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function checkAndSendReminders() {
  const to = process.env.REMINDER_TO_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) return;

  const due = findDueFixtures();
  for (const fixture of due) {
    try {
      const { subject, html } = buildEmail(fixture);
      await sendEmail({ to, subject, html });
      markSent(fixture.id);
      console.log(`[reminder] sent for ${fixture.id}: ${subject}`);
    } catch (err) {
      console.error(`[reminder] failed to send for ${fixture.id}:`, err.message);
    }
  }
}

module.exports = { checkAndSendReminders, findDueFixtures, buildEmail, getOpponent };
